// 《违背的青春》MV 第 6 版：黑板粉笔画。镜头表见 ../SHOTBOOK.md（S01–S28）。window.renderAt(t)。
import { clamp, lerp } from '/core/lib.js';
import { Stroke, line, curve, arc, rng, n1 } from './chalk.js';
import { renderFrame, drawSlate, cam, applyCam, characterLayers, W, H } from './main.js';
import { drawFox, TEX, HEADS, EXPR, BODY } from './puppet.js';
import { WORLD, WIPES, COL, add, grid, floorGrid, bike, star, door, waves, digit, hopscotch, crowd, desk, chair, bakeAll, drawWorld } from './world.js';

const SONG = await (await fetch('song.json')).json();
const BEATS = SONG.beats, DB = SONG.downbeats, BT = BEATS[1] - BEATS[0];
const ss = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };
const ramp = (t, a, b) => ss((t - a) / (b - a));
const eio = (x) => { x = clamp(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const load = (f) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = f; });
for (const who of ['kid', 'adult']) { for (let k = 0; k < 6; k++) HEADS[who].push(await load(`design/${who}_c${k}.png`)); HEADS[who].push(await load(`design/${who}_c0b.png`)); TEX[who] = await load(`design/tex_${who}.png`); }
const blink = (t, times) => times.some((b) => t >= b && t < b + 0.14);

// ================= 世界布局 =================
// 第一幕（现在，白）：x -3200..3200，地面 y=0
const A1 = { x0: -3200, x1: 3200, cell: 230 };
add(grid(-3200, -1500, 49, 9, 130, 'grey', 3.5), 0.6, 9.4, { group: 'cal' });
add(floorGrid(-3200, 3200, 0, 300, A1.cell, [0, -1600], 'white', 4.5), 6.2, 10.6, { group: 'floor' });
// 擦不干净的那块：灰雾里残留的彩色"1"和半个格子
const ghost = add([...digit(1, 1800, 70, 110, 'orange', 7), new Stroke([[1730, 50], [1930, 50], [1930, 200], [1730, 200], [1730, 50]], { color: COL.orange, w: 6, wob: 0.6 })], 0, 0.1, { instant: true, group: 'ghost' });
ghost.forEach((s) => (s.dim = (t) => (t < 23.6 ? 0.35 : 0.35 + 0.65 * ramp(t, 23.6, 24.4) * (1 - 0.6 * ramp(t, 26.5, 28.3)))));
WIPES.push({ t0: -1, t1: -0.5, path: [[1690, 125], [1970, 125]], w: 210, soft: 30, haze: 0.5, noErase: true });
// 愿望纸条：吉他和星星（被大人擦开）
const wish = add([new Stroke([[1710, 30], [1960, 22], [1968, 215], [1716, 222], [1710, 30]], { color: COL.white, w: 4 }), curve([[1760, 170], [1780, 120], [1820, 130], [1825, 175], [1780, 190], [1760, 170]], { color: COL.orange, w: 6 }), line(1820, 140, 1890, 60, { color: COL.orange, w: 6 }), line(1880, 52, 1905, 70, { color: COL.orange, w: 6 }), ...star(1910, 150, 30, 'yellow', 5)], 24.0, 25.6, { group: 'wish' });
wish.forEach((s) => (s.dim = (t) => 1 - 0.55 * ramp(t, 26.5, 28.3)));
// 一样的白自行车（会移动）
const bikesW = [];
for (let i = 0; i < 14; i++) { const B = add(bike(0, 0, 1.1, 'white', 5), 0, 0.1, { instant: true, group: 'bikeW' }); bikesW.push(B); }
const bikesC = [];
['red', 'blue', 'yellow', 'green', 'orange', 'pink'].forEach((c) => bikesC.push(add(bike(0, 0, 1.1, c, 6), 0, 0.1, { instant: true, group: 'bikeC' })));
// 门（大人用橙色粉笔头画）
const DOORX = 2380;
add(door(DOORX, 0, 230, 470, 'orange', 8), 68.3, 70.6, { group: 'door' });
add([new Stroke([[DOORX - 30, 6], [DOORX + 260, 6]], { color: COL.orange, w: 9 })], 70.6, 71.2, { group: 'doorline' });
// 第二幕（回忆，彩）：x 9000..15000
const A2 = { x0: 9000, cx: 12000 };
const reveal = (strokes, t0, span, x0, x1) => strokes.forEach((s) => { const sx = s.pts[0][0]; s.t0 = t0 + span * clamp((sx - x0) / (x1 - x0)); s.t1 = s.t0 + 0.28; });
const past = [];
past.push(...hopscotch(A2.cx - 620, 70, 190));
['red', 'blue', 'yellow', 'green', 'orange'].forEach((c, i) => past.push(...bike(A2.cx - 1700 + i * 300 + (i > 2 ? 1900 : 0), -20, 1.05, c, 6)));
for (let i = 0; i < 14; i++) { const R = rng(i + 3); past.push(...star(A2.cx - 1900 + R() * 3800, -1150 + R() * 500, 26 + R() * 30, ['yellow', 'orange', 'pink', 'blue'][i % 4], 5)); }
past.forEach((s) => WORLD.push(s)); reveal(past, 76.97, 0.75, A2.cx - 2200, A2.cx + 2200);
past.forEach((s) => { s.group = 'past'; s.hide = 1e9; });
// 少年画的大星星和闪电（跟着手）
const bigStar = star(A2.cx + 360, -560, 120, 'yellow', 9), bolt = [new Stroke([[A2.cx + 560, -720], [A2.cx + 500, -560], [A2.cx + 580, -560], [A2.cx + 510, -380]], { color: COL.orange, w: 9 })];
add(bigStar, 83.2, 84.6, { group: 'draw' }); add(bolt, 85.0, 85.8, { group: 'draw' });
// 夜里的光带（少年跑过手划出来的线）：按奔跑时手的轨迹生成
const TRAIL = { t0: 87.16, t1: 90.0, x0: A2.cx - 1500, speed: 900 };
{
  const pts = []; for (let t = TRAIL.t0; t <= TRAIL.t1; t += 0.05) { const x = TRAIL.x0 + (t - TRAIL.t0) * TRAIL.speed; pts.push([x + 90, -330 + Math.sin((t - TRAIL.t0) * 7) * 40]); }
  ['orange', 'yellow', 'blue'].forEach((c, k) => { const s = new Stroke(pts.map(([x, y]) => [x - k * 6, y + k * 16]), { color: COL[c], w: 9 - k * 2, wob: 1 }); s.t0 = TRAIL.t0 + 0.1 + k * 0.05; s.t1 = TRAIL.t1 + k * 0.05; s.o.ease = 0; s.group = 'trail'; s.hide = 1e9; WORLD.push(s); });
}
// 跳舞时绕身的彩线
const SPIN = { x: A2.cx + 1400 };
['orange', 'pink', 'blue', 'yellow'].forEach((c, k) => add([arc(SPIN.x, -330, 230 + k * 45, k, k + Math.PI * 1.7, { color: COL[c], w: 7, ry: (230 + k * 45) * 0.55 })], 90.3 + k * 0.4, 91.8 + k * 0.4, { group: 'spin' }));
// 波浪、岸、嘲笑的人影
const SEA = { x0: A2.cx + 2200, x1: A2.cx + 5200, y: 120 };
add(waves(SEA.x0, SEA.x1, SEA.y, 22, 4, ['blue', 'yellow', 'red', 'orange']), 92.9, 94.2, { group: 'sea' });
add([new Stroke([[SEA.x1 - 200, SEA.y - 40], [SEA.x1 + 300, SEA.y - 60]], { color: COL.green, w: 12, kind: 'side' })], 94.0, 94.6, { group: 'shore' });
add(crowd(SEA.x0 + 700, -760, 9, 1.1, 'white'), 95.6, 97.0, { group: 'crowd' });
// 第三幕（失陪）：x 22000..28000
const A3 = { cx: 25000 };
add(desk(A3.cx, 0, 520, 230, 'white', 6), 98.0, 98.5, { group: 'desk' });
add([new Stroke([[A3.cx - 10, -230], [A3.cx + 250, -230]], { color: COL.orange, w: 8 })], 98.0, 98.5, { group: 'desk' });
const chairA = add(chair(A3.cx - 420, 0, 1.6, 'white', 6), 98.0, 98.5, { group: 'chairA' });
add(chair(A3.cx + 340, 0, 1.6, 'orange', 6), 98.0, 98.5, { group: 'chairK' });
// 分开的黑板：左彩右白
const SPLIT = { x: 34000 };
add(hopscotch(SPLIT.x - 2300, 70, 170), 109.9, 110.0, { group: 'splitL', instant: true });
add(floorGrid(SPLIT.x + 300, SPLIT.x + 4400, 0, 280, 230, [SPLIT.x + 2300, -1500], 'white', 4.5), 109.9, 110.0, { group: 'splitR', instant: true });
add(grid(SPLIT.x + 300, -1300, 31, 8, 130, 'grey', 3.5), 109.9, 110.0, { group: 'splitR', instant: true });
add([line(SPLIT.x + 260, -900, SPLIT.x + 260, 280, { color: COL.white, w: 8 })], 118.7, 119.3, { group: 'barrier' });
// 尾声的板擦：从右往左擦过白格子和大人
WIPES.push({ t0: 129.2, t1: 136.8, path: [[SPLIT.x + 4600, -650], [SPLIT.x + 3000, -500], [SPLIT.x + 1500, -300], [SPLIT.x + 300, -200]], w: 1900, soft: 60, haze: 0.28 });

await new Promise((r) => setTimeout(r, 0));
bakeAll();

// ================= 动作 =================
// 走：s = 走过的距离；dir +1 往右；节拍对齐时 s 由调用方算
function walk(base, x0, s, o = {}) {
  const { dir = 1, stride = 0.5, stance = 0.6, lift = 30, swing = 0.45, bob = 6, sc = 1, lean = 0.04 } = o;
  const x = x0 + dir * s, q = s / stride, feet = {}, fl = {}, tilt = {}, rel = {};
  for (const [k, off] of [['n', 0], ['f', 0.5]]) {
    const qq = q + off, c = Math.floor(qq), f = qq - c, plant = (cc) => x0 + dir * (cc - off + 0.3) * stride;
    let fx, ly = 0, tl = 0;
    if (f < stance) fx = plant(c); else { const u = (f - stance) / (1 - stance); fx = lerp(plant(c), plant(c + 1), ss(u)); ly = Math.sin(u * Math.PI) * lift; tl = -0.3 * Math.sin(u * Math.PI); }
    feet[k] = [(fx - x) * dir / sc + (k === 'n' ? 10 : -14), 0]; fl[k] = ly / sc; tilt[k] = tl; rel[k] = (fx - x) * dir;
  }
  const ph = (q % 0.5) / 0.5;
  return { ...base, x, face: dir, scale: sc, feet, footLift: fl, footTilt: tilt, bob: -Math.abs(Math.sin(ph * Math.PI)) * bob + bob * 0.5, lean, swingN: -clamp(rel.n / stride, -1, 1) * swing, swingF: -clamp(rel.f / stride, -1, 1) * swing };
}
// 节拍步：每拍落一步（ks = 第几拍起步），步长 stepLen
function beatSteps(t, tStart, nSteps, stepLen) {
  const bi = BEATS.findIndex((b) => b > tStart) - 1, b0 = BEATS[Math.max(0, bi)];
  const k = (t - b0) / BT; if (k < 0) return 0; if (k >= nSteps) return nSteps * stepLen;
  const i = Math.floor(k), f = k - i; return (i + ss(Math.min(1, f / 0.7))) * stepLen;
}
const ADULT = { sc: 1, cell: A1.cell };
// 画一个角色（带包围盒，加速合成）
function fox(api, who, P) { const s = P.scale ?? 1, h = (who === 'kid' ? 640 : 860) * s; const G = characterLayers(api, [P.x - 520 * s, (P.y ?? 0) - h - 60 * s, P.x + 520 * s, (P.y ?? 0) + 90 * s]); const Q = { boil: api.boil, ...P }; drawFox(G, who, Q); return Q; }
// 粉笔头（橙）
const chalkStub = (len = 46) => (L, hn, hf, J) => { const [x, y] = hn; const p = [J(x - 6, y - len), J(x + 10, y - len + 4), J(x + 10, y + 4), J(x - 6, y)]; L.fill.fillStyle = '#f08a3c'; L.fill.beginPath(); p.forEach(([a, b], i) => (i ? L.fill.lineTo(a, b) : L.fill.moveTo(a, b))); L.fill.closePath(); L.fill.fill(); };
// 硬币（金，翻转；彩面是少年的笑脸）
function drawCoin(api, x, y, r, flip, faceUp = null) {
  const c = api.board, sx = Math.cos(flip), colored = faceUp ?? sx < 0;
  c.save(); applyCam(c); c.translate(x, y); c.scale(Math.max(0.06, Math.abs(sx)), 1);
  c.fillStyle = colored ? '#f2c14e' : '#d9d8d0'; c.globalAlpha = 0.92; c.beginPath(); c.arc(0, 0, r, 0, 6.29); c.fill();
  c.globalAlpha = 1; c.lineWidth = r * 0.08; c.strokeStyle = colored ? '#fff3c4' : '#f6f5ee'; c.beginPath(); c.arc(0, 0, r * 0.82, 0, 6.29); c.stroke();
  if (colored) { const img = HEADS.kid[1]; const k = r * 1.45 / img.height; c.drawImage(img, -img.width * k / 2, -img.height * k * 0.52, img.width * k, img.height * k); }
  else { c.strokeStyle = '#8f918a'; c.lineWidth = r * 0.06; c.beginPath(); c.moveTo(-r * 0.5, r * 0.3); c.lineTo(r * 0.5, r * 0.3); c.moveTo(-r * 0.3, -r * 0.2); c.lineTo(r * 0.3, -r * 0.2); c.stroke(); }
  c.restore();
}
function drawBoat(api, x, y, sc = 1, tilt = 0) {
  const c = api.board; c.save(); applyCam(c); c.translate(x, y); c.rotate(tilt); c.scale(sc, sc);
  c.fillStyle = '#f3efe2'; c.beginPath(); c.moveTo(-70, -10); c.lineTo(70, -10); c.lineTo(45, 26); c.lineTo(-45, 26); c.closePath(); c.fill();
  c.beginPath(); c.moveTo(-35, -10); c.lineTo(0, -70); c.lineTo(35, -10); c.closePath(); c.fill();
  c.strokeStyle = '#b8b2a0'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(0, -70); c.lineTo(0, -10); c.stroke(); c.restore();
}
function dust(api, x, y, t, t0, n = 40, spread = 300, col = '230,226,212') {
  const u = t - t0; if (u < 0 || u > 1.6) return; const c = api.board, R = rng(Math.floor(t0 * 100));
  c.save(); applyCam(c);
  for (let i = 0; i < n; i++) { const a = R() * 6.28, sp = (0.3 + R()) * spread, px = x + Math.cos(a) * sp * ss(u / 1.2), py = y + Math.sin(a) * sp * ss(u / 1.2) * 0.6 - u * 40; c.fillStyle = `rgba(${col},${0.55 * (1 - u / 1.6)})`; c.beginPath(); c.arc(px, py, 2 + R() * 4, 0, 6.29); c.fill(); }
  c.restore();
}
// 相机
function camTo(x, y, s, r = 0) { cam.x = x; cam.y = y; cam.s = s; cam.r = r; }
const lerpCam = (a, b, u) => camTo(lerp(a[0], b[0], u), lerp(a[1], b[1], u), Math.exp(lerp(Math.log(a[2]), Math.log(b[2]), u)), lerp(a[3] ?? 0, b[3] ?? 0, u));

// ================= 镜头 =================
const SB = (x) => BEATS.reduce((b, y) => (Math.abs(y - x) < Math.abs(b - x) ? y : b), BEATS[0]);
let NIGHT = 0;
const SHOTS = [
  [0, 5.65, (t, api) => {   // S01 大特：第一笔
    const u = ramp(t, 0.6, 5.6); lerpCam([-3150, -1500, 3.2], [-2650, -1420, 2.6], u);
  }],
  [5.65, 11.37, (t, api) => {   // S02 缓拉全貌，格子里一个小小的大人
    const u = eio((t - 5.65) / 5.72); lerpCam([-2600, -1400, 2.4], [-200, -500, 0.33], u);
    if (t > 9.2) fox(api, 'adult', { x: -1800, scale: 1, face: 1, ink: ramp(t, 9.2, 9.9), expr: 0, tailPh: t * 1.4, tailAmp: 0.1 });
  }],
  [11.37, 17.09, (t, api) => {   // S03 全景跟移：一拍一格
    const s = beatSteps(t, 11.6, 8, A1.cell);
    const P = walk({ expr: 0, tailPh: t * 2, tailAmp: 0.15, caseSwing: 0.1 * Math.sin(t * 4) }, -1800, s, { dir: 1, stride: A1.cell * 2, lift: 26, swing: 0.3, bob: 5, lean: 0.06 });
    P.headTilt = 0.1; P.eyes = blink(t, [13.2, 16.0]) ? 3 : 0; if (P.eyes) P.expr = 3;
    fox(api, 'adult', P); camTo(P.x + 150, -420, 0.72);
  }],
  [17.09, 22.81, (t, api) => {   // S04 特写脚：停在擦不干净的灰雾前
    const s = 8 * A1.cell + beatSteps(t, 17.09, 6, A1.cell * 0.9);
    const P = walk({ expr: 0, tailPh: t * 2, tailAmp: 0.12 }, -1800, Math.min(s, 3220 - 0), { dir: 1, stride: A1.cell * 1.8, lift: 24, swing: 0.3 });
    fox(api, 'adult', P); camTo(P.x + 160 * ramp(t, 20, 22), -120, 1.9 + 0.15 * ramp(t, 17.1, 22.8));
  }],
  [22.81, 28.53, (t, api) => {   // S05 近：蹲下擦开，露出彩色愿望纸条
    const x = -1800 + 3220, c = ramp(t, 22.9, 23.6);
    const wipe = t > 23.5 && t < 25.5 ? Math.sin((t - 23.5) * 9) * 60 : 0;
    const P = { x, scale: 1, face: 1, crouch: c * 1.0, lean: 0.55 * c, headTilt: 0.2 * c + 0.2 * ramp(t, 25.5, 26.5), expr: t > 26.5 ? 2 : 0, hands: c > 0.3 ? { n: [lerp(120, 300, c) + wipe, lerp(-300, -40, c)] } : null, elbowN: 1, tailPh: t * 1.5, tailAmp: 0.1, briefcase: false };
    if (t > 24.0) WIPES.length && null;
    fox(api, 'adult', P); camTo(x + 220, -260, 1.25 + 0.15 * ramp(t, 22.8, 28.5));
    // 手指擦开的灰雾：一块擦痕跟着手
    if (c > 0.3) dust(api, x + 330, 100, t, 23.6, 24, 120);
  }],
  [28.53, 33.54, (t, api) => {   // S06 大特：镜片里的星星，眨眼熄灭
    const x = -1800 + 3220;
    const P = { x, scale: 1, face: 1, crouch: 1, lean: 0.55, headTilt: 0.42, expr: blink(t, [31.5]) || t > 32.6 ? 3 : 2, hands: { n: [300, -40] }, briefcase: false, tailPh: t, tailAmp: 0.08 };
    const o = fox(api, 'adult', P)._out; const hx = x + (o.neck[0] + 70) , hy = o.neck[1] - 150;
    camTo(hx + 30, hy + 10, 2.6 + 0.2 * ramp(t, 28.5, 33.5));
    if (t < 31.5) { const c = api.board; c.save(); applyCam(c); c.globalAlpha = 0.85 * ramp(t, 28.8, 29.5); c.fillStyle = '#ffd96a'; c.translate(hx + 58, hy + 8); c.beginPath(); for (let k = 0; k <= 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? 6 : 14; c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } c.fill(); c.restore(); }
  }],
  [33.54, 39.26, (t, api) => {   // S07 远：一模一样的白车涌进来把他围住
    const x = 1420, u = (t - 33.54) / 5.72;
    fox(api, 'adult', { x, face: 1, expr: 0, headTilt: 0.05, tailPh: t * 1.5, tailAmp: 0.1, eyes: 0 });
    bikesW.forEach((B, i) => { const side = i % 2 ? 1 : -1, lane = Math.floor(i / 2), tx = x + side * (260 + lane * 210), sx = x + side * (2600 + lane * 300); const p = ramp(t, 33.8 + lane * 0.35, 35.6 + lane * 0.35); const bx = lerp(sx, tx, p), by = 40 + (lane % 3) * 90; B.forEach((s) => (s.move = [bx, by])); });
    lerpCam([x, -360, 0.75], [x, -320, 0.42], eio(u));
  }],
  [39.26, 44.98, (t, api) => {   // S08 中：车缝里挤着走；车铃一响闪回彩色
    const s = (t - 39.26) * 160, x0 = 1420;
    const P = walk({ expr: 2, tailPh: t * 2, tailAmp: 0.12 }, x0, s, { dir: 1, stride: 220, lift: 18, swing: 0.15, lean: 0.12 });
    fox(api, 'adult', P);
    const flash = t > SB(42.12) && t < SB(42.12) + BT;
    bikesW.forEach((B, i) => { const side = i % 2 ? 1 : -1, lane = Math.floor(i / 2); const bx = x0 + side * (260 + lane * 210) - (t - 39.26) * 60 * side, by = 40 + (lane % 3) * 90; B.forEach((s) => { s.move = [bx, by]; s.vis = !flash; }); });
    bikesC.forEach((B, i) => { const bx = x0 - 700 + i * 300, by = 60 + (i % 2) * 80; B.forEach((s) => { s.move = [bx, by]; s.vis = flash; }); });
    camTo(P.x + 60, -380, 0.9);
    dust(api, P.x, -300, t, 44.4, 70, 700);
  }],
  [44.98, 50.70, (t, api) => {   // S09 近：摸出橙色粉笔头
    const x = 1420 + 5.72 * 160 + 120, take = ramp(t, 45.4, 46.6), look = ramp(t, 46.4, 47.2);
    const P = { x, face: 1, expr: look > 0.5 ? 2 : 0, headTilt: 0.12 + 0.12 * look, tailPh: t, tailAmp: 0.08,
      hands: { n: [lerp(30, 120, take), lerp(-410, -470, take) + 8 * Math.sin(t * 5) * look] }, elbowN: 1, hold: take > 0.4 ? chalkStub() : null };
    fox(api, 'adult', P); camTo(x + 90, -520, 1.55 + 0.12 * ramp(t, 45, 50.7));
  }],
  [50.70, 56.42, (t, api) => {   // S10 特：凑近格子线，想画又收回
    const x = 1420 + 5.72 * 160 + 120, reach = ramp(t, 51.2, 53.0) * (1 - ramp(t, 54.4, 55.6));
    const P = { x, face: 1, expr: 2, headTilt: 0.2, crouch: 0.3 * reach, lean: 0.2 * reach, tailPh: t, tailAmp: 0.06, hands: { n: [lerp(120, 330, reach), lerp(-470, -120, reach)] }, elbowN: 1, hold: chalkStub() };
    fox(api, 'adult', P); camTo(x + 260, -250, 1.9 - 0.15 * ramp(t, 54.4, 56.4));
  }],
  [56.42, 62.14, (t, api) => {   // S11 硬币弹起，镜头跟着上摇
    const x = 1420 + 5.72 * 160 + 120, flipT = SB(59.28), up = t - flipT;
    const P = { x, face: 1, expr: up > 0 ? 4 : 0, headTilt: up > 0 ? -0.25 : 0.12, tailPh: t, tailAmp: 0.1, hands: { n: [130 + (up > 0 && up < 0.3 ? -20 : 0), up > -0.2 ? -520 : lerp(-300, -470, ramp(t, 56.6, 57.6))] }, elbowN: 1 };
    fox(api, 'adult', P);
    const hx = x + 130, hy = -520;
    const cy = up > 0 ? hy - 1300 * (1 - Math.pow(1 - clamp(up / 2.4), 2)) : hy - 10;
    drawCoin(api, hx, cy, 34, up > 0 ? up * 14 : 0, false);
    camTo(x + 120, lerp(-450, cy + 120, ramp(t, flipT, flipT + 1.6)), 1.15);
  }],
  [62.14, 67.14, (t, api) => {   // S12 大特：硬币在空中慢翻
    const r = 330, spin = (t - 62.14) * 1.6 + 1.2;
    drawCoin(api, 0, -2400, r, spin, null);
    camTo(0, -2400, 1.0 + 0.08 * ramp(t, 62.1, 67.1), 0.03 * Math.sin(t * 0.8));
    dust(api, 0, -2400, t, 62.2, 30, 600, '255,230,160');
  }],
  [67.14, 72.86, (t, api) => {   // S13 全：硬币落掌心，画一扇门，跨出去
    const x0 = 1420 + 5.72 * 160 + 120, catchT = 67.6, drawT = 68.3, walkT = 71.0;
    const draw = ramp(t, drawT, 70.6), handDoor = [lerp(DOORX + 20, DOORX + 230, clamp((t - drawT) / 2.3)), -470 * Math.sin(clamp((t - drawT) / 2.3) * Math.PI) - 10];
    let P;
    if (t < walkT) P = { x: x0, face: 1, expr: t > 70.6 ? 1 : 0, headTilt: 0.05, tailPh: t, tailAmp: 0.12, hands: t > drawT && t < 70.7 ? { n: [Math.min(560, handDoor[0] - x0), handDoor[1]] } : { n: [130, -520 + 380 * ramp(t, 67.14, catchT)] }, elbowN: 1, hold: t > drawT ? chalkStub() : null };
    else P = walk({ expr: 1, tailPh: t * 2, tailAmp: 0.2 }, x0, (t - walkT) * 300, { dir: 1, stride: 300, lift: 30, swing: 0.4 });
    fox(api, 'adult', P);
    if (t < drawT) drawCoin(api, x0 + 130, lerp(-1400, -520, ramp(t, 67.14, catchT)), 34, (t - 67.14) * 12, true);
    camTo(lerp(x0 + 300, DOORX - 100, ramp(t, 67.5, 70)), -380, 0.85);
  }],
  [72.86, 76.97, (t, api) => {   // S14 走进门，身后白格子一格格被擦掉，相机加速推进门
    const s = (t - 72.86) * 260, x0 = 1420 + 5.72 * 160 + 120 + 1.86 * 300;
    const P = walk({ expr: 1, tailPh: t * 2, tailAmp: 0.2 }, x0, s, { dir: 1, stride: 300, lift: 30 });
    P.ink = 1 - ramp(t, 75.4, 76.4);
    fox(api, 'adult', P);
    const u = Math.pow(clamp((t - 73.5) / 3.47), 2.4); lerpCam([DOORX + 100, -330, 0.85], [DOORX + 115, -240, 9], u);
    NIGHT = 0.6 * ramp(t, 75.5, 76.9);
  }],
  [76.97, 81.44, (t, api) => {   // S15 ★ 板擦横扫，彩色的过去整板揭开；少年叉腰站在跳房子正中
    const u = eio((t - 76.97) / 2.2); lerpCam([A2.cx, -300, 2.6], [A2.cx, -420, 0.42], u);
    fox(api, 'kid', { x: A2.cx - 620 + 190 * 2, face: 1, expr: 2, scale: 1.1, hands: { n: [70, -150], f: [-80, -150] }, elbowN: -1, elbowF: 1, headTilt: -0.12, tailPh: t * 3, tailAmp: 0.35, ink: ramp(t, 77.1, 77.6) });
    const c = api.board; c.save(); applyCam(c); const bx = lerp(A2.cx - 2600, A2.cx + 2600, clamp((t - 76.97) / 0.75)); c.fillStyle = 'rgba(70,92,80,0.35)'; c.filter = 'blur(40px)'; c.fillRect(bx - 160, -2000, 320, 2600); c.restore();
    dust(api, A2.cx, -600, t, 77.0, 120, 2400, '230,226,212');
  }],
  [81.44, 87.16, (t, api) => {   // S16 少年斜眼扬眉，大笔画星星和闪电
    const kx = A2.cx - 620 + 190 * 2, dr = t > 83.1 && t < 85.9;
    const sp = (t - 83.2) / 1.4, starHand = t < 84.6 ? [A2.cx + 360 + Math.cos(-Math.PI / 2 + sp * 4 * Math.PI) * 120, -560 + Math.sin(-Math.PI / 2 + sp * 4 * Math.PI) * 120] : [lerp(A2.cx + 560, A2.cx + 510, ramp(t, 85, 85.8)), lerp(-720, -380, ramp(t, 85, 85.8))];
    const P = { x: kx, face: 1, scale: 1.1, expr: t < 82.7 ? 2 : t < 86 ? 2 : 1, headTilt: -0.15 + 0.1 * ramp(t, 85.9, 86.6), tailPh: t * 3, tailAmp: 0.35,
      hands: dr ? { n: [(starHand[0] - kx) / 1.1, starHand[1] / 1.1], f: [-80, -150] } : { n: [70, -150], f: [-80, -150] }, elbowN: dr ? 1 : -1, elbowF: 1, lean: dr ? 0.1 : 0 };
    fox(api, 'kid', P);
    camTo(lerp(kx + 150, kx + 280, ramp(t, 81.4, 87.2)), lerp(-420, -470, ramp(t, 81.4, 87.2)), 0.95 + 0.1 * Math.sin((t - 81.44) * 0.5), 0.02 * Math.sin((t - 81.44) * 0.9));
  }],
  [87.16, 90.02, (t, api) => {   // S17 夜：闭眼摸黑奔跑，手划出彩色光带
    NIGHT = 1; const s = (t - TRAIL.t0) * TRAIL.speed;
    const P = walk({ expr: 5, tailPh: t * 6, tailAmp: 0.5, scale: 1.1 }, TRAIL.x0, s, { dir: 1, stride: 520, stance: 0.42, lift: 70, swing: 0.2, bob: 16, lean: 0.18, sc: 1.1 });
    P.hands = { n: [190, -330 / 1.1 + Math.sin((t - TRAIL.t0) * 7) * 36 - 0], f: [-120, -260] }; P.elbowN = -1;
    fox(api, 'kid', P); camTo(P.x + 120, -420, 0.8);
  }],
  [90.02, 92.88, (t, api) => {   // S18 在星星间转圈跳舞
    NIGHT = 1; const ph = (t - 90.02) * 2.3 * Math.PI, hop = Math.abs(Math.sin((t - 90.02) / BT * Math.PI)) * 30;
    const sx = Math.cos(ph), face = sx >= 0 ? 1 : -1;
    fox(api, 'kid', { x: SPIN.x, face: 1, sx: Math.sign(sx || 1) * Math.max(0.12, Math.abs(sx)), scale: 1.1, expr: 1, lift: hop, hands: { n: [150, -330], f: [-150, -320] }, elbowN: -1, elbowF: 1, tailPh: t * 8, tailAmp: 0.6 });
    camTo(SPIN.x, -430 - 40 * ramp(t, 90, 92.9), 0.85 + 0.15 * ramp(t, 90, 92.9), 0.04 * Math.sin(t * 1.2));
  }],
  [92.88, 95.74, (t, api) => {   // S19 近：蹲下，从书包里拿出纸船放在波浪边
    NIGHT = 1; const x = SEA.x0 - 150, c = ramp(t, 93.0, 93.6), place = ramp(t, 94.4, 95.2);
    const hand = [lerp(100, 230, place), lerp(-260, -10, place)];
    fox(api, 'kid', { x, face: 1, scale: 1.1, crouch: c, lean: 0.4 * c, headTilt: 0.25 * c, expr: 0, hands: { n: hand }, elbowN: 1, tailPh: t * 2, tailAmp: 0.25 });
    drawBoat(api, x + hand[0] * 1.1 + 30, lerp(-260, 80, place) * (place > 0 ? 1 : 0) + (place > 0 ? 0 : -260), 0.9);
    camTo(x + 260, -180, 1.35);
  }],
  [95.74, 98.60, (t, api) => {   // S20 远：纸船穿过嘲笑靠岸
    NIGHT = 1; const u = clamp((t - 95.74) / 2.7), bx = lerp(SEA.x0 + 150, SEA.x1 - 120, eio(u));
    drawBoat(api, bx, SEA.y + 14 + Math.sin(t * 5) * 8, 1.1, 0.08 * Math.sin(t * 4));
    fox(api, 'kid', { x: SEA.x0 - 150, face: 1, scale: 1.1, crouch: 0.6, lean: 0.2, headTilt: -0.1, expr: 2, tailPh: t * 2, tailAmp: 0.25 });
    camTo(lerp(SEA.x0 + 700, SEA.x1 - 600, eio(u)), -330, 0.48);
  }],
  [98.60, 104.32, (t, api) => {   // S21 课桌两边对坐；大人起身"失陪"
    NIGHT = 0.3; const up = ramp(t, SB(101.46), SB(101.46) + 0.8);
    chairA.forEach((s) => (s.move = [-140 * up, 0]));
    fox(api, 'kid', { x: A3.cx + 300, face: -1, scale: 1.05, crouch: 0.9, expr: up > 0.5 ? 0 : 0, headTilt: -0.05, hands: { n: [130, -235 / 1.05] }, elbowN: 1, tailPh: t * 2, tailAmp: 0.2, look: 1 });
    fox(api, 'adult', { x: A3.cx - 330 - 60 * up, face: 1, crouch: 1 - up, headTilt: 0.15 * up, expr: up > 0.3 ? 2 : 0, hands: up < 0.3 ? { n: [150, -235] } : null, briefcase: up > 0.6, tailPh: t, tailAmp: 0.1 });
    camTo(A3.cx, -420, 0.75 + 0.05 * ramp(t, 98.6, 104.3));
  }],
  [104.32, 110.04, (t, api) => {   // S22 正反打：少年抬头看他 / 大人别开脸
    NIGHT = 0.3; const rev = t >= SB(107.18);
    fox(api, 'kid', { x: A3.cx + 300, face: -1, scale: 1.05, crouch: 0.9, expr: rev ? 0 : 3, headTilt: -0.15, hands: { n: [130, -235 / 1.05] }, tailPh: t * 2, tailAmp: 0.15, eyes: blink(t, [105.6]) ? 1 : 0 });
    fox(api, 'adult', { x: A3.cx - 470, face: rev ? -1 : 1, expr: 2, headTilt: 0.18, tailPh: t, tailAmp: 0.08 });
    if (!rev) camTo(A3.cx + 330, -560, 1.7 + 0.1 * ramp(t, 104.3, 107.2)); else camTo(A3.cx - 470, -760, 1.6 + 0.1 * ramp(t, 107.2, 110));
  }],
  [110.04, 115.76, (t, api) => {   // S23 大远：黑板一分为二，大人越走越远
    NIGHT = 0.3; const s = (t - 110.04) * 330, sc = lerp(1, 0.55, ramp(t, 110.5, 115.7));
    fox(api, 'kid', { x: SPLIT.x - 2300 + 170 * 2, face: 1, scale: 1.05, expr: 3, headTilt: -0.05, tailPh: t, tailAmp: 0.1 });
    const P = walk({ expr: 2, tailPh: t * 1.5, tailAmp: 0.1 }, SPLIT.x + 500, s, { dir: 1, stride: 300 * sc, lift: 22 * sc, sc });
    P.y = -60 * (1 - sc); fox(api, 'adult', P);
    lerpCam([SPLIT.x - 200, -420, 0.38], [SPLIT.x + 100, -440, 0.3], eio((t - 110.04) / 5.72));
  }],
  [115.76, 118.62, (t, api) => {   // S24 近：少年的脸，颜色被灰雾盖上
    NIGHT = 0.3; const kx = SPLIT.x - 2300 + 170 * 2;
    fox(api, 'kid', { x: kx, face: 1, scale: 1.05, expr: 3, headTilt: -0.05, tailPh: t, tailAmp: 0.08, eyes: 0 });
    camTo(kx + 10, -470, 2.0 + 0.15 * ramp(t, 115.8, 118.6));
    const c = api.board; c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = `rgba(58,76,66,${0.42 * ramp(t, 116.3, 118.5)})`; c.filter = 'blur(30px)'; c.fillRect(-100, -100, W + 200, H + 200); c.restore();
  }],
  [118.62, 122.91, (t, api) => {   // S25 中：回头奔两步，被白线拦住，手伸向少年
    NIGHT = 0.3; const x0 = SPLIT.x + 1400, turn = ramp(t, 118.7, 119.0), run = clamp((t - 119.0) / 1.0);
    const P = run > 0 ? walk({ expr: 5, tailPh: t * 5, tailAmp: 0.3 }, x0, Math.min(run, 1) * 760, { dir: -1, stride: 420, stance: 0.45, lift: 40, lean: 0.15 }) : { x: x0, face: -1, expr: 5, tailPh: t, tailAmp: 0.1 };
    if (t > 120.1) { P.x = x0 - 760 + 20 * Math.sin((t - 120.1) * 20) * Math.exp(-(t - 120.1) * 4); P.feet = null; P.footLift = null; P.hands = { n: [300, -560] }; P.elbowN = -1; P.lean = -0.05; P.expr = 5; P.face = -1; }
    fox(api, 'adult', P);
    camTo(lerp(x0 - 200, x0 - 600, ramp(t, 118.8, 120.4)), -420, 0.75);
  }],
  [122.91, 128.63, (t, api) => {   // S26 摊开手，把彩面朝上的硬币放在格子线上
    NIGHT = 0.3; const x = SPLIT.x + 640, put = ramp(t, 124.6, 126.2);
    fox(api, 'adult', { x, face: -1, crouch: put * 1.0, lean: 0.4 * put, headTilt: 0.25 + 0.1 * put, expr: t > 126.5 ? 3 : 2, hands: { n: [lerp(200, 260, put), lerp(-470, -20, put)] }, elbowN: 1, tailPh: t, tailAmp: 0.08 });
    const hx = x - lerp(200, 260, put) - 0, hy = lerp(-490, 10, put);
    drawCoin(api, hx, t > 126.2 ? 22 : hy, 30, 0, true);
    lerpCam([hx, hy - 30, 2.2], [x - 150, -380, 0.9], eio((t - 122.91) / 5.7));
  }],
  [128.63, 137.21, (t, api) => {   // S27 板擦从右往左擦过：大人被擦淡，少年留下
    NIGHT = 0.3; const kx = SPLIT.x - 2300 + 170 * 2, x = SPLIT.x + 640;
    fox(api, 'kid', { x: kx, face: 1, scale: 1.05, expr: 3, headTilt: -0.05, tailPh: t, tailAmp: 0.08 });
    fox(api, 'adult', { x, face: -1, crouch: 0.3, lean: 0.1, headTilt: 0.3, expr: 3, ink: 1 - ramp(t, 133.5, 136.0), tailPh: t, tailAmp: 0.05 });
    drawCoin(api, x - 260, 22, 30, 0, true);
    lerpCam([SPLIT.x + 600, -420, 0.4], [SPLIT.x - 500, -420, 0.36], eio((t - 128.63) / 8.6));
  }],
  [137.21, 147.03, (t, api) => {   // S28 只剩硬币和一截粉笔头，后拉冷却
    NIGHT = 0.3 + 0.5 * ramp(t, 140, 146.5); const x = SPLIT.x + 640;
    drawCoin(api, x - 260, 22, 30, 0, true);
    const roll = ramp(t, 139.5, 141.5), c = api.board; c.save(); applyCam(c); c.translate(x - 160 + roll * 40, 30); c.rotate(roll * 1.6); c.fillStyle = '#f08a3c'; c.fillRect(-22, -8, 44, 16); c.restore();
    lerpCam([x - 210, -40, 2.4], [SPLIT.x - 700, -400, 0.28], eio((t - 137.21) / 9.6));
  }],
];
SHOTS.forEach((s) => { s[0] = SB(s[0]) > s[0] - 0.4 && s[0] > 1 ? s[0] : s[0]; });

// ================= 合成 =================
const layer = { cv: new OffscreenCanvas(W, H), w: W, h: H, s: 1 }; layer.ctx = layer.cv.getContext('2d');
window.renderAt = (t) => renderFrame(t, (t, api) => {
  NIGHT = 0;
  for (const s of WORLD) { s.move = null; s.vis = !(s.group === 'bikeW' || s.group === 'bikeC'); }
  const shot = SHOTS.find((s) => t >= s[0] && t < s[1]) || SHOTS[SHOTS.length - 1];
  // 先把相机设好（镜头函数里设），所以分两步：先跑一遍拿相机，人物等动态在第二步画
  const pending = [];
  const fakeApi = { ...api, board: api.board };
  // 1) 黑板 + 夜色
  shot[2](t, { ...api, dyn: () => ({ fill: dummy, line: dummy }), flushDyn: () => {}, board: dummy, _probe: true });
  drawSlate(api.board);
  if (NIGHT > 0) { api.board.save(); api.board.setTransform(1, 0, 0, 1, 0, 0); api.board.fillStyle = `rgba(4,10,22,${0.42 * NIGHT})`; api.board.fillRect(0, 0, W, H); api.board.restore(); }
  // 2) 静态粉笔
  layer.s = cam.s;
  const S = 1 / cam.s, view = [cam.x - W / 2 * S - 200, cam.y - H / 2 * S - 200, cam.x + W / 2 * S + 200, cam.y + H / 2 * S + 200];
  drawWorldMoved(api.board, t, view);
  // 3) 镜头里的人物和动态道具
  shot[2](t, api);
});
const dummy = new Proxy({}, { get: (o, k) => (typeof k === 'string' && ['canvas'].includes(k) ? null : () => {}) , set: () => true });
function drawWorldMoved(ctx, t, view) {
  // 带位移的笔画：临时把 sprite 坐标平移
  const moved = [];
  for (const s of WORLD) {
    if (s.vis === false) { s._hideSave = s.hide; s.hide = -1; moved.push(s); continue; }
    if (s.move && s.sprite) { s._x0 = s.sprite.x0; s._y0 = s.sprite.y0; s.sprite.x0 += s.move[0]; s.sprite.y0 += s.move[1]; moved.push(s); }
  }
  drawWorld(ctx, t, view, layer, applyCam);
  for (const s of moved) { if (s._hideSave !== undefined) { s.hide = s._hideSave; delete s._hideSave; } if (s._x0 !== undefined) { s.sprite.x0 = s._x0; s.sprite.y0 = s._y0; delete s._x0; delete s._y0; } }
}
window.SHOTS = SHOTS.map((s) => [s[0], s[1]]);
window.READY = true;
