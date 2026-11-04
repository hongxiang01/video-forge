// S8（21.0–24.0）外景多层降镜：雪夜小街，「老街面馆」门脸（TREATMENT §4 S8、§5、附 1、附 3）。粗剪版。
// 层（视差）：天空电线板 0.25 → 远雪 0.5 → 门脸板 1.0（含路灯、排气口白汽）→ 中雪 1.0 → 近雪 1.8。
// 降镜：21.0–23.25 门脸板上移 1100 px（ease-out 三次），之后定住。背景板第一次 draw 时画一次（颜色板 + 发光板），每帧只平移；雪、白汽每帧动。
import { canvas, cel, poly, path, airbrush, vgrad, mix, rgba, hash, W, H, TAU } from '../lib/cel.js';
import { BG, SNOW } from '../pal.js';
import { snow } from '../fx.js';
import * as PL from '../plates.js';

const DROP = 1100, LAND = 2.25;
const SKY_Y = -360, FACE_Y = -520;          // 两张板顶边在门脸坐标里的 y
const SKY_H = 1440, FACE_H = 1600;
const LAMP = [432, 104];                    // 路灯头（门脸坐标，定住后的屏幕坐标）
const VENT = [952, 452];                    // 排气口
const K = {   // 外景雪夜套（§4.3 背景板「窗外雪夜」：靛蓝、雪青灰、路灯金），描边用深靛不用纯黑
  sky0: '#070920', sky1: '#121840', sky2: BG.night.indigo, glow: '#30366A', farB: '#0F122C',
  wire: '#0A0C1E', wall: '#262850', wallS: '#1A1B3C', line: '#0C0E24', shopW: '#46406A', shopS: '#2C284E',
  roof: '#181A34', snow: SNOW.mid, snowS: SNOW.far, snowHi: SNOW.near, side: '#7A82AC', road: '#5E6692', print: '#363C6A',
  warm: '#F2B25C', glowE: '#FFD9A0', gold: BG.night.lampGold, lampSnow: SNOW.lampSnow,
  curtain: '#2A3862', curtainS: '#1A2446', curtainHi: '#4A5C90', signFace: '#F6E4B4', signInk: '#4A2A1E', frame: '#201A2E',
  step: '#46446E', stepS: '#2A2850', shut: '#383A60', shutL: '#24264A', win: '#141834',
};
const font = px => `700 ${px}px "${PL.FONT || 'PingFang SC'}", "PingFang SC", sans-serif`;
const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
const box = (g, x0, y0, x1, y1, f, l = K.line, lw = 2) => cel(g, poly(rect(x0, y0, x1, y1)), { f, l, lw });

// 积雪盖子：顶边起伏、底边略垂，硬边平涂 + 底下一道雪青灰影
function cap(g, x0, x1, y, h, sd) {
  const top = [], n = Math.max(4, Math.round((x1 - x0) / 26));
  for (let i = 0; i <= n; i++) top.push([x0 + (x1 - x0) * i / n, y - h * (.55 + .45 * hash(sd + i * 1.7))]);
  const pts = [[x0 - 4, y + 3], ...top, [x1 + 4, y + 3], [(x0 + x1) / 2, y + 3 + h * .25]];
  cel(g, path(pts), { f: K.snow, s: K.snowS, so: [0, -3], l: K.snowS, lw: 1.5 });
}
function icicles(g, x0, x1, y, sd) {
  g.fillStyle = K.snowS;
  for (let x = x0 + 8; x < x1 - 6; x += 18 + 14 * hash(sd + x)) {
    const L = 8 + 22 * hash(sd + x * 3.1);
    g.beginPath(); g.moveTo(x - 4, y); g.lineTo(x + 4, y); g.lineTo(x + .5, y + L); g.closePath(); g.fill();
  }
}
function windows(g, xs, ys, w, h, sd, lit = {}) {
  for (const x of xs) for (const y of ys) {
    const k = `${x},${y}`;
    box(g, x - 6, y - 6, x + w + 6, y + h + 6, K.wallS);
    box(g, x, y, x + w, y + h, lit[k] || K.win, K.line, 1.5);
    g.fillStyle = K.line; g.fillRect(x + w / 2 - 2, y, 4, h);
    cap(g, x - 10, x + w + 10, y + h + 8, 9, sd + x + y);
  }
}

// —— 天空电线板（0.25）：夜空喷枪渐变 + 远处屋脊剪影 + 电线杆和四根下垂电线（线上一道雪）——
function skyPlate() {
  const [c, g] = canvas(W, SKY_H);
  vgrad(g, 0, 0, W, SKY_H, [[0, K.sky0], [.5, K.sky1], [.78, K.sky2], [1, K.glow]]);
  airbrush(g, 980, 1180, 1100, 260, K.glow, .55, .9);
  const R = [[0, 980], [140, 940], [300, 1000], [460, 930], [700, 990], [880, 950], [1100, 1010], [1300, 940], [1520, 985], [1720, 925], [1920, 970]];
  for (let i = 0; i < R.length - 1; i++) box(g, R[i][0], R[i][1], R[i + 1][0] + 2, SKY_H, K.farB, K.farB);
  g.fillStyle = mix(K.farB, K.warm, .35);
  for (let i = 0; i < 26; i++) if (hash(i * 7.3) < .5) g.fillRect(40 + i * 72, 1040 + 120 * hash(i * 3.9), 10, 14);
  // 电线杆 + 横担
  box(g, 1690, 380, 1712, SKY_H, K.wire, K.wire);
  box(g, 1610, 412, 1790, 424, K.wire, K.wire);
  const sag = (a, b, s) => { const p = []; for (let i = 0; i <= 30; i++) { const u = i / 30; p.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u + s * 4 * u * (1 - u)]); } return p; };
  const wires = [[[1622, 418], [-40, 380], 110], [[1660, 418], [-40, 440], 120], [[1740, 418], [-40, 520], 150], [[1778, 418], [-40, 600], 160], [[1700, 412], [1980, 470], 20]];
  for (const [a, b, s] of wires) {
    const p = sag(a, b, s);
    g.strokeStyle = K.wire; g.lineWidth = 3; g.beginPath(); p.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke();
    g.strokeStyle = rgba(K.snowS, .9); g.lineWidth = 1.5; g.beginPath(); p.forEach(([x, y], i) => i ? g.lineTo(x, y - 2) : g.moveTo(x, y - 2)); g.stroke();
  }
  cap(g, 1606, 1794, 412, 6, 91);
  return c;
}

// —— 门脸板（1.0）：两侧打烊的邻楼、面馆门脸（灯箱、高窗、卷帘门箱、棉门帘、三级台阶、排气口）、路灯、雪地与脚印 ——
function facePlate() {
  const [c, g] = canvas(W, FACE_H), [ce, e] = canvas(W, FACE_H);
  g.translate(0, -FACE_Y); e.translate(0, -FACE_Y);
  // 雪地：人行道 + 马路（马路离机位近，在下面），两道车辙
  box(g, -10, 852, W + 10, 930, K.side, K.side);
  box(g, -10, 926, W + 10, 1090, K.road, K.road);
  g.fillStyle = K.snowS; g.fillRect(-10, 924, W + 20, 5);
  g.fillStyle = rgba(K.print, .45);
  for (const y0 of [980, 1046]) { const p = []; for (let i = 0; i <= 24; i++) p.push([i * 84, y0 + 6 * Math.sin(i * 1.3)]); for (let i = 24; i >= 0; i--) p.push([i * 84, y0 + 16 + 5 * Math.sin(i * 1.1 + 2)]); g.fill(poly(p)); }
  // 左邻楼（高，打烊）
  box(g, -10, -470, 606, 860, K.wall);
  cap(g, -14, 610, -470, 16, 11);
  windows(g, [70, 330], [-380, -160, 70], 150, 150, 3, { '330,-160': '#4A5288' });
  box(g, 40, 596, 560, 860, K.shut, K.line);
  g.fillStyle = K.shutL; for (let y = 612; y < 860; y += 16) g.fillRect(42, y, 516, 3);
  box(g, 20, 572, 580, 598, K.wallS); cap(g, 16, 584, 572, 10, 13);
  // 右邻楼
  box(g, 1214, -260, 1930, 860, K.wall);
  cap(g, 1210, 1934, -260, 14, 17);
  windows(g, [1300, 1560], [-170, 60], 160, 150, 5, { '1560,60': '#9A6A48' });
  box(g, 1270, 596, 1880, 860, K.shut, K.line);
  g.fillStyle = K.shutL; for (let y = 612; y < 860; y += 16) g.fillRect(1272, y, 606, 3);
  box(g, 1250, 572, 1900, 598, K.wallS); cap(g, 1246, 1904, 572, 10, 19);
  // 面馆：二层墙、瓦檐、积雪、冰溜子
  box(g, 606, 160, 1214, 860, K.shopW);
  g.fillStyle = K.shopS; g.fillRect(608, 384, 604, 18); g.fillRect(608, 160, 604, 14);   // 灯箱、檐口下的硬边影
  cel(g, poly([[574, 170], [1246, 170], [1214, 116], [606, 116]]), { f: K.roof, l: K.line, lw: 2 });
  g.fillStyle = K.line; for (let x = 600; x < 1240; x += 22) g.fillRect(x, 150, 3, 20);
  cap(g, 600, 1220, 118, 26, 23); icicles(g, 580, 1240, 170, 29);
  windows(g, [834], [196], 152, 74, 31);
  // 灯箱「老街面馆」
  box(g, 612, 294, 1208, 386, K.frame, K.line, 2.5);
  box(g, 622, 304, 1198, 376, K.signFace, K.frame, 1.5);
  g.font = font(60); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = K.signInk;
  const SIGN = ['老', '街', '面', '馆'];
  SIGN.forEach((ch, i) => g.fillText(ch, 700 + i * 140, 342));
  cap(g, 608, 1212, 294, 14, 37);
  // 卷帘门箱（卷在窗顶）
  cel(g, poly(rect(628, 414, 910, 446)), { f: K.shut, s: K.shutL, sh: [rect(628, 434, 910, 446)], l: K.line, lw: 2 });
  g.fillStyle = K.shutL; for (let y = 420; y < 446; y += 8) g.fillRect(632, y, 274, 2);
  cap(g, 624, 914, 414, 8, 41);
  // 高窗：暖光 + 蒙汽 + 外看正写「手擀面」+ 里面墨绿灯罩的剪影
  box(g, 632, 440, 904, 574, K.frame, K.line, 2.5);
  box(g, 642, 448, 894, 566, K.warm, K.frame, 1.5);
  g.save(); g.beginPath(); g.rect(642, 448, 252, 118); g.clip();
  g.fillStyle = mix(K.warm, '#FFF2D6', .45);
  for (let i = 0; i < 9; i++) { const x = 660 + 26 * i + 18 * hash(i * 5.1), y = 530 + 30 * hash(i * 2.3); g.beginPath(); g.ellipse(x, y, 30 + 16 * hash(i), 12 + 6 * hash(i * 4), 0, 0, TAU); g.fill(); }
  g.fillStyle = mix(K.warm, '#FFF2D6', .25); g.fillRect(642, 552, 252, 14);
  g.restore();
  g.fillStyle = K.shade; cel(g, poly([[800, 448], [832, 448], [852, 470], [780, 470]]), { f: '#1C2A26', l: K.line, lw: 1.5 });
  // r2：窗上的字和屋里那扇是同一层褪色白漆（漆在玻璃里侧，A 里看是反写），从街上看是正字「手擀面」，一格一个字；
  // 漆挡住屋里的暖光，朝街的一面只吃到路灯和雪光 → 冷一点的旧白，比亮着的玻璃暗一档，边上一线淡框色
  g.font = font(54); g.fillStyle = '#8A86A6'; g.strokeStyle = rgba(K.frame, .8); g.lineWidth = 3; g.lineJoin = 'round';
  ['手', '擀', '面'].forEach((ch, i) => { g.strokeText(ch, 684 + i * 84, 510); g.fillText(ch, 684 + i * 84, 510); });
  g.fillStyle = K.frame; g.fillRect(724, 448, 6, 118); g.fillRect(808, 448, 6, 118);
  cap(g, 626, 910, 576, 10, 43);
  // 排气口
  box(g, VENT[0] - 22, VENT[1] - 4, VENT[0] + 22, VENT[1] + 36, '#20203C', K.line, 2);
  g.fillStyle = '#4A4A72'; for (let y = VENT[1] + 2; y < VENT[1] + 34; y += 7) g.fillRect(VENT[0] - 18, y, 36, 2);
  // 门：门框 + 棉门帘。r2：原来是一块绗缝方块、看着像玻璃门 → 一块厚棉布从门楣横杆垂下：四道竖褶，
  // 下摆坠着棉絮往外鼓、一兜一兜，褶缝处收尖；两边和下摆一道浅色滚边。屋里的光从两边和下摆漏一线
  box(g, 1002, 414, 1162, 744, K.frame, K.line, 2.5);
  g.fillStyle = K.warm; g.fillRect(1012, 424, 140, 320);
  {
    const x0 = 1018, x1 = 1146, y0 = 430, y1 = 722, n = 4, hem = [], F = 7;   // F：下摆往两边鼓出去的量
    for (let i = 0; i <= 4 * n; i++) hem.push([x1 + F - (x1 - x0 + 2 * F) * i / (4 * n), y1 + [0, 12, 17, 12][i % 4] + (i % 4 ? 3 * hash(i * 2.7) : 0), i % 4 ? 0 : 1]);   // 右 → 左：四兜圆鼓，兜和兜之间的褶缝收尖
    const B = [[x0 - 2, y0, 1], [x1 + 2, y0, 1], [x1 + 4, y0 + 160], ...hem, [x0 - 4, y0 + 160]];
    const topX = i => x0 + (x1 - x0) * (1 - i / (4 * n));
    const sh = [4, 8, 12].map(i => [[topX(i) - 1, y0], [topX(i) + 3, y0], [hem[i][0] + 12, hem[i + 1][1] - 4], [hem[i][0] + 2, hem[i][1] + 2], [hem[i][0] - 3, hem[i][1] - 16]]);   // 褶缝：顶上一线，往下摆张开（背着路灯的右侧）
    sh.push([[x1 - 10, y0], [x1 + 9, y0], [x1 + 9, y1 + 24], [hem[2][0] + 6, hem[2][1] + 2], [x1 - 8, y0 + 170]]);   // 最右一兜背光
    const hi = [6, 10, 14].map(i => [[topX(i) - 8, y0 + 70], [topX(i) - 3, y0 + 70], [hem[i][0] - 3, hem[i][1] - 20], [hem[i][0] - 11, hem[i][1] - 16]]);   // 每一兜朝路灯（左）的鼓面一道亮
    const CP = cel(g, path(B, true, .7), { f: K.curtain, s: K.curtainS, sh, h: K.curtainHi, hi, l: K.line, lw: 2 });
    g.save(); g.clip(CP); g.strokeStyle = '#C9C5DA'; g.lineWidth = 10;   // 浅色滚边：下摆顺着兜走一道，两边竖着一道
    g.stroke(path(hem.map(([x, y, k]) => [x, y - 5, k]), false, .8));
    g.lineWidth = 7; g.beginPath(); g.moveTo(x0 + 1, y0); g.lineTo(x0 - 1, y0 + 160); g.lineTo(hem[4 * n][0] + 4, hem[4 * n][1]); g.moveTo(x1 - 1, y0); g.lineTo(x1 + 1, y0 + 160); g.lineTo(hem[0][0] - 4, hem[0][1]); g.stroke();
    g.restore();
    g.fillStyle = K.curtainS; g.fillRect(1014, 428, 136, 8);   // 横杆下的一道影
    g.fillStyle = K.frame; g.fillRect(1008, 421, 148, 8);      // 门楣横杆
  }
  // 三级台阶（店比街高 0.75 m）：踏面积雪、立面深
  for (let k = 0; k < 3; k++) {
    const y = 740 + 40 * k, dx = 7 * k;
    box(g, 984 - dx, y + 10, 1180 + dx, y + 40, K.step, K.line, 2);
    g.fillStyle = K.stepS; g.fillRect(984 - dx, y + 30, 196 + 2 * dx, 10);
    cel(g, path([[980 - dx, y + 12], [984 - dx, y], [1180 + dx, y], [1184 + dx, y + 12]]), { f: K.snow, l: K.snowS, lw: 1.5 });
  }
  // 脚印：从马路弯到台阶，再一级一级上去（近大远小）
  const P0 = [560, 1068], P1 = [820, 900], P2 = [1086, 870];
  for (let i = 0; i < 13; i++) {
    const u = i / 12, x = (1 - u) ** 2 * P0[0] + 2 * u * (1 - u) * P1[0] + u * u * P2[0], y = (1 - u) ** 2 * P0[1] + 2 * u * (1 - u) * P1[1] + u * u * P2[1];
    const sd = i % 2 ? 1 : -1, rx = 5 + (y - 840) * .05;
    g.fillStyle = K.print; g.beginPath(); g.ellipse(x + sd * 9, y, rx, rx * .45, -.35, 0, TAU); g.fill();
  }
  for (const [x, y] of [[1074, 827], [1096, 787], [1076, 747]]) { g.fillStyle = K.print; g.beginPath(); g.ellipse(x, y + 4, 6, 3, 0, 0, TAU); g.fill(); }
  // 高窗的光落在人行道上（硬边梯形）
  g.fillStyle = rgba(K.warm, .18); g.fill(poly([[650, 862], [890, 862], [940, 920], [610, 920]]));
  g.fillStyle = rgba(K.warm, .22); g.fill(poly([[996, 862], [1170, 862], [1186, 900], [990, 900]]));
  // 路灯（人行道外沿，离机位近）：杆、弯臂、灯头；光锥和地上的光圈
  box(g, 386, 140, 398, 968, K.line, K.line);
  g.strokeStyle = K.line; g.lineWidth = 8; g.beginPath(); g.moveTo(392, 150); g.quadraticCurveTo(396, 92, LAMP[0], LAMP[1] - 8); g.stroke();
  cel(g, poly([[LAMP[0] - 30, LAMP[1] + 8], [LAMP[0] + 30, LAMP[1] + 8], [LAMP[0] + 12, LAMP[1] - 12], [LAMP[0] - 12, LAMP[1] - 12]]), { f: '#1A1C34', l: K.line, lw: 2 });
  cap(g, LAMP[0] - 14, LAMP[0] + 14, LAMP[1] - 12, 6, 47);
  const cone = poly([[LAMP[0] - 26, LAMP[1] + 10], [LAMP[0] + 26, LAMP[1] + 10], [LAMP[0] + 290, 986], [LAMP[0] - 250, 986]]);
  g.fillStyle = rgba(K.gold, .07); g.fill(cone);
  g.fillStyle = rgba(SNOW.near, .4); g.beginPath(); g.ellipse(LAMP[0] + 20, 960, 290, 40, 0, 0, TAU); g.fill();
  g.fillStyle = K.lampSnow; g.beginPath(); g.ellipse(LAMP[0], LAMP[1] + 12, 24, 7, 0, 0, TAU); g.fill();
  // —— 发光板：先印整张门脸的黑剪影，再画自己发光的：灯箱面、高窗、门帘漏光、路灯头和光锥、楼上那扇暖窗 ——
  e.setTransform(1, 0, 0, 1, 0, 0); e.drawImage(c, 0, 0); e.globalCompositeOperation = 'source-in'; e.fillStyle = '#000'; e.fillRect(0, 0, W, FACE_H);
  e.globalCompositeOperation = 'source-over'; e.translate(0, -FACE_Y);
  e.fillStyle = rgba('#FFE6A8', .8); e.fillRect(622, 304, 576, 72);
  e.fillStyle = rgba(K.glowE, .85); e.fillRect(642, 448, 252, 118);
  e.fillStyle = rgba(K.glowE, .9); e.fillRect(1012, 430, 4, 200); e.fillRect(1148, 430, 4, 200); e.fillRect(1012, 738, 140, 5);
  e.fillStyle = rgba(K.glowE, .35); e.fillRect(1560, 60, 160, 150);
  e.fillStyle = rgba(K.gold, .12); e.fill(cone);
  e.fillStyle = K.gold; e.beginPath(); e.ellipse(LAMP[0], LAMP[1] + 12, 26, 9, 0, 0, TAU); e.fill();
  e.fillStyle = '#000'; e.strokeStyle = '#000'; e.lineWidth = 6; e.lineJoin = 'round'; e.font = font(60); e.textAlign = 'center'; e.textBaseline = 'middle';
  SIGN.forEach((ch, i) => { e.strokeText(ch, 700 + i * 140, 342); e.fillText(ch, 700 + i * 140, 342); });
  e.font = font(54); e.lineWidth = 14; ['手', '擀', '面'].forEach((ch, i) => { e.strokeText(ch, 684 + i * 84, 510); e.fillText(ch, 684 + i * 84, 510); });   // r2：挖宽一圈，光晕不再把漆字吃掉
  e.fillRect(724, 448, 6, 118); e.fillRect(808, 448, 6, 118); e.fillRect(780, 448, 72, 22);
  e.fillRect(386, 140, 12, 828);
  return { c, e: ce };
}

let P = null;
const plates = () => P || (P = { sky: skyPlate(), face: facePlate() });
const io = u => u < .5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2;
const lerp = (a, b, m) => a + (b - a) * m;

// 排气口的白汽。r2：原来是一缕细线 → 一团柔雾：一团团软边雾从口里鼓出来，往上飘、胀开、变淡，被风往右带；雪夜冷色，不加暖边
function vapor(g, x, y, t) {
  for (let k = 0; k < 7; k++) {
    const age = (t * .4 + k / 7) % 1, a = Math.sin(Math.PI * Math.min(1, age * 1.4)) ** .8 * (1 - age);
    const px = x + 34 * age + 30 * age * age + 8 * Math.sin(t * .9 + k * 2.1), py = y + 4 - 140 * age - 40 * age * age, r = 24 + 92 * age;
    airbrush(g, px, py, r, r * .78, '#C8CEE8', .5 * a, .95);
    airbrush(g, px - r * .2, py - r * .22, r * .55, r * .42, '#E2E6F4', .28 * a, .9);
  }
  airbrush(g, x + 4, y + 2, 36, 24, '#C8CEE8', .42, .9);   // 口上那一团一直在
}

export function draw(g, e, lt, A, t) {
  const p = Math.min(1, Math.max(0, lt / LAND)), D = DROP * (1 - p) ** 3;   // ease-out 三次：剩余降程
  const { sky, face } = plates(), lamp = [LAMP[0], LAMP[1] + D, 180];
  // r2 S8→S9 出点「落在暖光的窗上」：降镜收尾时接着慢慢推向那扇窗（窗心 (768, 507) 往画面中间挪、放大 12%），四边始终盖满
  const m = io(Math.min(1, Math.max(0, (lt - 1.7) / 1.3))), z = 1 + .12 * m, T = [lerp(768, 850, m), lerp(507, 535, m)];
  for (const c of [g, e]) { c.save(); c.translate(T[0], T[1]); c.scale(z, z); c.translate(-768, -507); }
  g.drawImage(sky, 0, SKY_Y + D * .25);
  snow(g, e, t, { layers: ['far'], crane: D, lamp, seed: 8 });
  g.drawImage(face.c, 0, FACE_Y + D); e.drawImage(face.e, 0, FACE_Y + D);
  vapor(g, VENT[0], VENT[1] + D, t);
  snow(g, e, t, { layers: ['mid'], crane: D, lamp, seed: 8 });
  snow(g, e, t, { layers: ['near'], crane: D, lamp, seed: 8 });
  g.restore(); e.restore();
  // r2 S7→S8 入点：S7 最后一帧全白，这里从白里亮回雪夜天空（头 8 帧，平方淡出）
  if (lt < .34) { g.fillStyle = rgba('#FFFFFF', .96 * (1 - lt / .34) ** 2); g.fillRect(0, 0, W, H); }
  return {};
}
