// S3（6.0–9.0 s）近景 · 低机位斜俯（台面上 30 cm、往下 9.8°）· 固定：逆光半剪影揉面，三渲二（2D 版原样备份在 s3_2d.js）。6.00 / 6.75 / 7.50 / 8.25 每拍一推：
// 掌根推出（面团被压长）→ 四指勾住远边往回折 → 左手扣住转 90°（TREATMENT §4 / §5，CONTINUITY S2→S3、S3→S4）。
// 背景照旧是 2D 的窗（A 里那扇：三格、反写「手擀面」、窗顶卷帘门卷筒、右格路灯金光），台面换成三维木板（远沿对齐 2D 墙脚 HOR），
// 面团、手、前臂和袖子是三维：卡通材质两阶硬边 + 彩色描边；一盏白色方向光从左上、略偏窗那边照（吊灯），硬边投影，不加环境光
// → 朝镜头的一面自然落进暗阶，只有顶面和左肩受光；窗外冷光 = 按前景剪影在朝上 / 两侧的边内勾 2–4 px 雪光蓝。
// 世界坐标（米）：X 向右，Y 向上，Z 朝镜头（师傅这一侧）；面团中心在原点，台面 y = 0。手和面团按 12 fps 换张。
// 第四拍收在「转」上（面团转过来、双手还按在面上），9.00 切 S4 正俯推杖。
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { cel, rgba, mix, rng, hash, airbrush, vgrad, canvas, line, TAU, W, H } from '../lib/cel.js';
import { C, SNOWLIGHT_RIM, BG, SNOW, LIGHT } from '../pal.js';
import { FONT } from '../plates.js';
import { toon, sun, draw3d, renderer } from '../lib3d.js';
import { makeHand } from '../hand3d.js';

const f12 = t => Math.floor(t * 12 + 1e-6) / 12;
const DOUGH = C('dough'), FLOUR = C('flour');
const HOR = 690, YB = 792;                                   // 台面远沿（墙脚）、面团底线
// 窗：layout.WIN（宽 1.6 m、高 0.75 m、窗棂 ±0.27 宽 4 cm）按 750 px/m 正面摆进画面，窗台 y 640、窗顶 y 70
const WX = X => 960 + X * 750, WY = Y => 640 - (Y - 1.10) * 760;
const WIN = { x0: WX(-.8), x1: WX(.8), y0: WY(1.85), y1: WY(1.10), mull: [-.27, .27].map(m => [WX(m - .02), WX(m + .02)]) };
const ROLL = 36;                                             // 卷帘门卷在窗上沿（A 里 14 px；这里离得近、往上看）
const LAMP = [WX(.64), WIN.y0 + ROLL + 34];                  // 路灯：在右格右上、紧挨卷筒下面的一团金光
const LETTERS = [['面', WX(-.535)], ['擀', WX(0)], ['手', WX(.535)]], LET = { top: WY(1.42), s: .22 * 760 };

const panes = () => { const p = new Path2D(), xs = [WIN.x0, ...WIN.mull.flat(), WIN.x1]; for (let i = 0; i < xs.length; i += 2) p.rect(xs[i], WIN.y0, xs[i + 1] - xs[i], WIN.y1 - WIN.y0); return p; };
const band = (g, y0, y1, col) => { g.fillStyle = col; g.fillRect(WIN.x0 - 4, WIN.y0 + y0, WIN.x1 - WIN.x0 + 8, y1 - y0); };

// 反写字的遮罩：镜像（从屋里看）+ 褪色剥落的小洞和两道擦痕
function glyph(ch, seed) {
  const N = 256, [c, g] = canvas(N, N), R = rng(seed);
  g.translate(N, 0); g.scale(-1, 1);
  g.font = `600 ${N * .9}px ${FONT ? `"${FONT}"` : 'sans-serif'}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = '#fff'; g.fillText(ch, N / 2, N / 2 + N * .04);
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 420; i++) { g.globalAlpha = .4 + R() * .6; g.beginPath(); g.arc(R() * N, R() * N, .8 + R() * R() * 7, 0, TAU); g.fill(); }
  for (let i = 0; i < 2; i++) { g.globalAlpha = .15 + R() * .15; g.fillRect(0, R() * N, N, 2 + R() * 4); }
  return c;
}

// —— 背景板（加载后画一次）：back = 墙 + 窗外（夜、对面楼、路灯、卷筒、雪埂）+ 窗框 + 台面；front = 玻璃上的反光和反写字（压在雪上）——
let PL = null;
function plate() {
  if (PL) return PL;
  const [c, g] = canvas(W, H), [ce, e] = canvas(W, H), [cf, f] = canvas(W, H), [cfe, fe] = canvas(W, H), R = rng(33), P = panes();
  e.fillStyle = '#000'; e.fillRect(0, 0, W, H);
  vgrad(g, 0, 0, W, HOR, [[0, '#4E3A50'], [1, '#7A5A5C']]);
  airbrush(g, 160, -60, 760, 520, BG.warm.wallNear, .5, .9);            // 吊灯在画外左上
  // 窗外：夜空 → 对面楼（雪顶）→ 亮窗 → 路灯（灯头在窗上沿外，右格里一团金光、冷雪光包着）
  g.save(); g.clip(P);
  vgrad(g, WIN.x0, WIN.y0, WIN.x1 - WIN.x0, WIN.y1 - WIN.y0, [[0, '#161C44'], [.55, BG.night.indigo], [1, '#343C6C']]);
  airbrush(g, LAMP[0], LAMP[1], 330, 170, BG.night.snowGrey, .3, 1);
  airbrush(g, LAMP[0], LAMP[1], 150, 100, BG.night.lampGold, .45, 1);
  g.fillStyle = '#141838'; g.beginPath(); g.moveTo(WIN.x0, 380); g.lineTo(700, 350); g.lineTo(1010, 372); g.lineTo(1300, 338); g.lineTo(WIN.x1, 360); g.lineTo(WIN.x1, WIN.y1); g.lineTo(WIN.x0, WIN.y1); g.fill();
  g.fillStyle = BG.night.snowGrey; g.beginPath(); g.moveTo(WIN.x0, 380); g.lineTo(700, 350); g.lineTo(1010, 372); g.lineTo(1300, 338); g.lineTo(WIN.x1, 360); g.lineTo(WIN.x1, 372); g.lineTo(1300, 352); g.lineTo(1010, 386); g.lineTo(700, 364); g.lineTo(WIN.x0, 394); g.fill();
  for (let i = 0; i < 9; i++) { const x = 440 + i * 128 + R() * 30, y = 430 + R() * 110; if (R() < .45) continue; g.fillStyle = '#C89850'; g.fillRect(x, y, 30, 40); e.fillStyle = rgba('#FFD27A', .35); e.fillRect(x, y, 30, 40); }
  g.fillStyle = '#FFF2C8'; g.beginPath(); g.ellipse(LAMP[0], LAMP[1], 18, 9, 0, 0, TAU); g.fill();
  // 窗台外的雪埂：玻璃下沿一道起伏的雪
  const ridge = new Path2D(); ridge.moveTo(WIN.x0, WIN.y1 + 2);
  for (let n = 0; n <= 60; n++) { const x = WIN.x0 + n / 60 * (WIN.x1 - WIN.x0); ridge.lineTo(x, WIN.y1 - 16 - 9 * Math.sin(x * .013) - 6 * hash(n + 3)); }
  ridge.lineTo(WIN.x1, WIN.y1 + 2); ridge.closePath();
  g.fillStyle = mix(SNOW.far, SNOW.mid, .3); g.fill(ridge); g.strokeStyle = SNOW.mid; g.lineWidth = 3; g.stroke(ridge);
  // 卷帘门卷筒：深色钢卷筒，三道横向硬边高光一档比一档弱，最下是底杠的唇和玻璃上一线暗影（同 A 的画法，按 36 / 14 放大）
  const BODY = mix(BG.dark.grain, BG.night.indigo, .25);
  band(g, 0, ROLL, BODY); band(g, 2.6, 7.7, mix(SNOW.mid, BODY, .2)); band(g, 7.7, 10.3, BG.dark.grain);
  band(g, 18, 22, mix(BG.night.snowGrey, BODY, .3)); band(g, 28.3, 31.9, mix(BG.night.snowGrey, BODY, .58)); band(g, 31.9, ROLL, BG.dark.grain);
  g.restore();
  e.save(); e.clip(P);
  airbrush(e, LAMP[0], LAMP[1], 150, 100, BG.night.lampGold, .8, 1); e.fillStyle = '#FFF2C8'; e.beginPath(); e.ellipse(LAMP[0], LAMP[1], 18, 9, 0, 0, TAU); e.fill();
  e.fillStyle = '#000'; e.fillRect(0, WIN.y0, W, ROLL);
  e.restore();
  // 窗框（旧木框，上沿出画）+ 两根窗棂：暖灯从左上照，左半正面受光、右端背光；右棂露出的侧面朝左迎灯（木色），左棂侧面背灯（暗）
  const FC = [mix(BG.warm.woodHalo, BG.warm.wallNear, .3), mix(BG.warm.wood, BG.warm.woodHalo, .45), mix(BG.warm.grain, BG.warm.woodDark, .4)];
  const fr = new Path2D(); fr.rect(WIN.x0 - 34, -10, WIN.x1 - WIN.x0 + 68, WIN.y1 + 34 + 10); fr.addPath(P);
  const fg = g.createLinearGradient(WIN.x0 - 34, 0, WIN.x1 + 34, 0); fg.addColorStop(0, FC[0]); fg.addColorStop(.4, FC[1]); fg.addColorStop(1, FC[2]);
  g.save(); g.shadowColor = rgba(BG.warm.woodDark, .55); g.shadowBlur = 10; g.shadowOffsetX = 4; g.shadowOffsetY = 5; g.fillStyle = fg; g.fill(fr, 'evenodd'); g.restore();
  e.fillStyle = '#000'; e.fill(fr, 'evenodd');
  const [[a0, a1], [b0, b1]] = WIN.mull;
  g.fillStyle = FC[2]; g.fillRect(a1, WIN.y0, 9, WIN.y1 - WIN.y0); g.fillStyle = mix(BG.warm.wood, BG.warm.woodHalo, .25); g.fillRect(b0 - 9, WIN.y0, 9, WIN.y1 - WIN.y0);
  e.fillRect(a1, WIN.y0, 9, WIN.y1 - WIN.y0); e.fillRect(b0 - 9, WIN.y0, 9, WIN.y1 - WIN.y0);
  g.strokeStyle = rgba(LIGHT.warm, .68); g.lineWidth = 2; g.beginPath(); g.moveTo(WIN.x0, WIN.y1); g.lineTo(WIN.x1, WIN.y1); g.lineTo(WIN.x1, WIN.y0); g.stroke();
  g.strokeStyle = rgba(LIGHT.warm, .62); g.lineWidth = 1.6; for (const x of [a0, b0]) { g.beginPath(); g.moveTo(x, WIN.y0); g.lineTo(x, WIN.y1); g.stroke(); }
  g.fillStyle = '#3A2420'; g.fillRect(WIN.x0 - 50, WIN.y1 + 34, WIN.x1 - WIN.x0 + 100, 12);                     // 窗台下沿的影
  // 台面：贴着看，木纹越近越疏；灯圈偏左（吊灯在左上）；远沿一条窗光
  vgrad(g, 0, HOR, W, H - HOR, [[0, '#6A4030'], [.25, BG.warm.wood], [1, '#3E2A3C']]);
  airbrush(g, 820, YB - 10, 820, 160, BG.warm.woodHalo, .75, .8);
  for (let k = 1; k < 16; k++) { const y = HOR + (H - HOR) * Math.pow(k / 16, 1.7); g.strokeStyle = rgba(BG.warm.grain, .3); g.lineWidth = 1 + k * .12; g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= W; x += 40) g.lineTo(x, y + 3 * Math.sin(x * .004 + k)); g.stroke(); }
  g.fillStyle = rgba(BG.night.snowGrey, .5); g.fillRect(0, HOR, W, 4);
  for (let i = 0; i < 260; i++) { const x = 560 + R() * 820, y = YB - 6 + Math.pow(R(), 2) * 120; g.fillStyle = rgba(FLOUR.f, .5 + R() * .4); g.fillRect(x, y, 2 + R() * 3, 1.5 + R() * 1.5); }
  // 玻璃上（front）：斜着几道硬边冷反光 + 反写「手擀面」（褪色旧白漆，暖灯下 60%，靠灯一侧略暖）
  f.save(); f.clip(P); fe.save(); fe.clip(P);
  for (const [x0, w, a] of [[-.74, .07, .056], [-.6, .025, .044], [-.18, .09, .036], [.36, .05, .04], [.47, .02, .036]]) {
    f.fillStyle = rgba(SNOW.mid, a); f.beginPath(); f.moveTo(WX(x0 + .24), WIN.y0 + ROLL); f.lineTo(WX(x0 + w + .24), WIN.y0 + ROLL); f.lineTo(WX(x0 + w), WIN.y1); f.lineTo(WX(x0), WIN.y1); f.fill();
  }
  LETTERS.forEach(([ch, cx], i) => {
    const m = glyph(ch, 11 + i), [tc, tg] = canvas(m.width, m.height);
    tg.drawImage(m, 0, 0); tg.globalCompositeOperation = 'source-in'; tg.fillStyle = mix(BG.warm.wallNear, SNOW.mid, .18 + i * .05); tg.fillRect(0, 0, tc.width, tc.height);
    f.globalAlpha = .6; f.drawImage(tc, cx - LET.s / 2, LET.top, LET.s, LET.s); fe.globalAlpha = .6; fe.drawImage(m, cx - LET.s / 2, LET.top, LET.s, LET.s);
  });
  fe.globalCompositeOperation = 'source-in'; fe.globalAlpha = 1; fe.fillStyle = '#000'; fe.fillRect(0, 0, W, H);
  f.restore(); fe.restore();
  PL = { c, e: ce, f: cf, fe: cfe, P }; return PL;
}

// —— 三维 ——
const D2R = Math.PI / 180, DR = 0.11, DH = 0.08, ZN = 0.40;            // 面团半径、高；台面近沿 z
// 机位：台面上 30 cm、往下 9.8°（低机位斜俯，看得到面团顶面和手背；高过前臂 → 前臂从下角出画、不横挡窗）；台面远沿（墙脚）正好落在 2D 的 HOR，面团离墙约 30 cm
const CAM = { p: [0.07, 0.30, 0.95], fov: 23, pitch: 9.8 };
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// 台面板：横铺木板（同 S4 / plates 的暖灯台面画法），灯圈偏左（吊灯在左上），远沿一线窗光，面团周围散粉
const KP = 1200, X0 = -1.2, XW = 2.4;
function boardTex(zW) {
  const DZ = ZN - zW, [c, x] = canvas(Math.round(XW * KP), Math.round(DZ * KP)), w = c.width, h = c.height, B = BG.warm, R = rng(303);
  const toP = (X, Z) => [(X - X0) * KP, (Z - zW) * KP];
  x.fillStyle = B.wood; x.fillRect(0, 0, w, h);
  const pw = 0.135 * KP;
  for (let i = 0, y0 = -0.03 * KP; y0 < h; i++, y0 += pw) {
    x.fillStyle = mix(B.wood, i % 2 ? '#6A3C20' : '#8A5634', .45); x.fillRect(0, y0, w, pw);
    const gc = mix(B.wood, B.grain, .55);
    for (let j = 0; j < 9; j++) { const yy = y0 + pw * (.08 + .84 * R()), pts = []; for (let xx = -40; xx < w + 80; xx += 160) pts.push([xx, yy + Math.sin(xx / (300 + 200 * R()) + j) * (4 + 6 * R())]); line(x, pts, gc, 1.4 + R() * 1.6); }
    x.fillStyle = B.grain; x.fillRect(0, y0 - 3, w, 6); x.fillStyle = mix(B.wood, '#C08A55', .45); x.fillRect(0, y0 + 3, w, 3);
  }
  const [hx, hy] = toP(-0.28, -0.05);
  airbrush(x, hx, hy, 0.75 * KP, 0.42 * KP, B.woodHalo, .8, .95);
  const gr = x.createRadialGradient(hx, hy, 0.25 * KP, hx, hy, 1.0 * KP); gr.addColorStop(0, rgba(B.woodDark, 0)); gr.addColorStop(1, rgba(B.woodDark, .85)); x.fillStyle = gr; x.fillRect(0, 0, w, h);
  x.fillStyle = rgba(BG.night.snowGrey, .55); x.fillRect(0, 0, w, 0.004 * KP);                       // 远沿一线窗光
  const fl = C('flour').f;
  for (let i = 0; i < 520; i++) { const a = R() * TAU, d = 0.13 + Math.pow(R(), 2) * 0.32, [px, py] = toP(Math.cos(a) * d * 1.3, Math.sin(a) * d * .8); x.fillStyle = rgba(fl, .5 + .5 * R()); x.beginPath(); x.arc(px, py, 1.2 + 2.6 * R(), 0, TAU); x.fill(); }
  const t = new THREE.CanvasTexture(c); t.anisotropy = renderer().r.capabilities.getMaxAnisotropy(); return t;
}

// 面团：单位球（合并缝上的顶点，法线不断）→ 底平的馒头形 → 推长（远半边拉长、变薄）→ 掌根压窝 → 远边绕折痕翻回来盖在顶上 → 整体转
const SPH = (() => { const g = new THREE.SphereGeometry(1, 96, 64); g.deleteAttribute('uv'); g.deleteAttribute('normal'); return mergeVertices(g); })();
function xf(ux, uy, uz, st, o) {
  const { s = 0, ph = 0, pr = 0, hx = 0, hz = 0, yaw = 0, seam = 0 } = st, zh = 0.02, k = 1 + 0.65 * s, zt = zh + (-DR - zh) * k, zf = zh + (zt - zh) * .62, yf = DH * .62;   // 折痕靠远端：翻回来的唇短一点
  let x = DR * ux * (1 + .14 * s), y = DH * Math.max(0, (uy + .22) / 1.22) * (1 - .12 * s), z = DR * uz;   // 推的时候往两边摊、变矮（正面也看得出被压）
  if (seam) y -= .006 * Math.exp(-(((x - .04) / .008) ** 2)) * (y / DH) ** 2;                      // 上一折留下的接缝（转过 90° 后顺着推的方向）
  if (z < zh) { const t = Math.min(1, (zh - z) / (DR + zh)); z = zh + (z - zh) * k; y *= 1 - .32 * s * t; }
  if (pr) y -= pr * Math.exp(-((x - hx) ** 2 + (z - hz) ** 2) / .042 ** 2) * (y / DH);
  if (ph) { const a = ph * sm(zf + .03, zf - .05, z), ca = Math.cos(a), sa = Math.sin(a), dz = z - zf, dy = y - yf; z = zf + dz * ca + dy * sa; y = yf - dz * sa + dy * ca; }
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  o[0] = x * cy + z * sy; o[1] = y; o[2] = -x * sy + z * cy; return o;
}
// 转的两张：折好的形往一团圆面团上靠（kb），一边转一边揉圆 → 和下一拍「咚」的那团面接得上
function doughGeo(st, geo) {
  const P = SPH.attributes.position, a = geo.attributes.position.array, o = [0, 0, 0], m = [0, 0, 0], kb = st.kb || 0, F = { ...st, yaw: 0 }, cy = Math.cos(st.yaw || 0), sy = Math.sin(st.yaw || 0);
  for (let i = 0; i < P.count; i++) {
    xf(P.getX(i), P.getY(i), P.getZ(i), F, o);
    if (kb) { xf(P.getX(i), P.getY(i), P.getZ(i), {}, m); for (let j = 0; j < 3; j++) o[j] += (m[j] - o[j]) * kb; }
    a[i * 3] = o[0] * cy + o[2] * sy; a[i * 3 + 1] = o[1]; a[i * 3 + 2] = -o[0] * sy + o[2] * cy;
  }
  geo.attributes.position.needsUpdate = true; geo.computeVertexNormals(); geo.computeBoundingSphere();
}
function topAt(geo, x, z, r = .014) { const a = geo.attributes.position.array; let m = 0; for (let i = 0; i < a.length; i += 3) if (Math.abs(a[i] - x) < r && Math.abs(a[i + 2] - z) < r && a[i + 1] > m) m = a[i + 1]; return m; }

// 手型（度）：四指 [张开, 掌指弯, 中节弯, 末节弯]，拇指 [指根张开, 指根弯, 第二节, 末节]
const POSE = {
  push:  { thumb: [10, 14, 10, 5], index: [7, 12, 14, 6], middle: [1, 13, 15, 7], ring: [-5, 15, 16, 7], pinky: [-12, 17, 16, 7] },   // 掌根压，四指松搭
  reach: { thumb: [8, 16, 12, 6], index: [5, 30, 40, 20], middle: [0, 32, 42, 22], ring: [-4, 34, 44, 22], pinky: [-9, 36, 44, 22] },
  hook:  { thumb: [4, 22, 18, 8], index: [4, 44, 70, 40], middle: [0, 46, 72, 42], ring: [-3, 48, 72, 42], pinky: [-7, 50, 70, 40] },  // 勾住远边
  press: { thumb: [8, 16, 10, 5], index: [6, 20, 26, 12], middle: [0, 22, 28, 12], ring: [-4, 24, 28, 12], pinky: [-9, 26, 26, 12] },
  ready: { thumb: [8, 18, 14, 8], index: [6, 22, 28, 14], middle: [0, 24, 30, 14], ring: [-4, 26, 30, 14], pinky: [-9, 28, 28, 13] },
  hold:  { thumb: [12, 16, 10, 6], index: [5, 24, 28, 12], middle: [0, 26, 30, 13], ring: [-4, 28, 30, 13], pinky: [-9, 30, 28, 12] },
  grip:  { thumb: [10, 24, 18, 8], index: [4, 36, 46, 22], middle: [0, 38, 48, 24], ring: [-3, 40, 48, 24], pinky: [-7, 42, 46, 22] },
};
// 每拍 9 张（12 fps）：0 咚（掌根落下）、1 推、2 推到头、3 伸到远边、4 勾起、5 往回折、6 折上来压住、7 转、8 转到位（右手抬起预备下一推）
const DSEQ = [{ s: .35, pr: .016 }, { s: .75, pr: .014 }, { s: 1, pr: .008 }, { s: 1 }, { s: 1, ph: .8 }, { s: 1, ph: 2.25 }, { s: 1, ph: 2.95, pr: .005 }, { s: 1, ph: 2.95, turn: .5, kb: .45 }, { s: 1, ph: 2.95, turn: 1, kb: .8 }];
const HZ = [.035, 0, -.035];

let S = null;
function setup() {
  if (S) return S;
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(CAM.fov, W / H, 0.02, 20);
  cam.position.set(...CAM.p); cam.lookAt(0, CAM.p[1] - CAM.p[2] * Math.tan(CAM.pitch * D2R), 0); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
  const v = new THREE.Vector3(0, -(HOR - H / 2) / (H / 2), .5).unproject(cam).sub(cam.position).normalize(), zW = cam.position.z + v.z * (-cam.position.y / v.y);
  const DZ = ZN - zW, board = new THREE.Mesh(new THREE.PlaneGeometry(XW, DZ), new THREE.MeshBasicMaterial({ map: boardTex(zW) }));
  board.rotation.x = -Math.PI / 2; board.position.set(X0 + XW / 2, 0, (zW + ZN) / 2);
  const shade = new THREE.Mesh(new THREE.PlaneGeometry(XW, DZ), new THREE.ShadowMaterial({ color: new THREE.Color(BG.warm.woodDark), opacity: .6 }));
  shade.rotation.x = -Math.PI / 2; shade.position.set(board.position.x, .0004, board.position.z); shade.receiveShadow = true;
  const front = new THREE.Mesh(new THREE.PlaneGeometry(XW, .5), new THREE.MeshBasicMaterial({ color: new THREE.Color('#3A2632') })); front.position.set(X0 + XW / 2, -.25, ZN);
  const lip = new THREE.Mesh(new THREE.PlaneGeometry(XW, .006), new THREE.MeshBasicMaterial({ color: new THREE.Color(mix(BG.warm.wood, BG.warm.woodHalo, .5)) })); lip.position.set(X0 + XW / 2, -.003, ZN + .0005);
  for (const m of [board, shade, front, lip]) { m.userData.bg = true; m.material.userData.outlineParameters = { visible: false }; scene.add(m); }
  const geo = SPH.clone(); geo.setAttribute('position', SPH.attributes.position.clone());
  const dough = new THREE.Mesh(geo, toon(C('dough'), { t: .1, w: .0028 })); dough.castShadow = dough.receiveShadow = true; scene.add(dough);
  // 面团顶上的干粉（S2 的那团面带过来）：取球面上半的固定一组顶点，每张跟着变形后的面贴着放，朝法线
  const fr = rng(57), P0 = SPH.attributes.position, ids = []; for (let i = 0; i < P0.count && ids.length < 60; i++) if (P0.getY(i) > .35 && fr() < .03) ids.push([i, (1.4 + fr() * 2.6) * .001]);
  const specks = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 7), toon(C('flour'), { line: false }), ids.length); specks.userData.ids = ids; specks.receiveShadow = true; scene.add(specks);
  const hands = { L: makeHand('L'), R: makeHand('R') };
  for (const k of ['L', 'R']) scene.add(hands[k].root, hands[k].arm);
  sun(scene, [-0.6, 1.0, -0.38], 0.7, [0, 0.05, 0.05]);
  return (S = { scene, cam, dough, hands, specks });
}

function place(H, pose, p, pitch, yaw, roll) {
  H.pose(POSE[pose]); H.root.position.set(...p); H.root.rotation.set(pitch * D2R, yaw * D2R, roll * D2R, 'YXZ');
}
// 胳膊：hand3d 的 reachArm（前臂 + 上臂两段，肘在中间弯）。两个肩是同一个人的：身体中线 x = MAN.x，两肩相距 .40。
// 这一镜机位只比台面高 30 cm、在台沿外 55 cm：照真人的肩高（台面上 35–45 cm）摆，上臂会从画面上角斜插进来、右肩的截口也进画；
// 所以把肩压在画框下沿那个面以下 MAN.drop（截口和上臂都在画外），胳膊从画面下方两角进来（CONTINUITY：师傅在近侧，手从下沿进）。
// 人跟着右手动：每张解出两肩中点的 z，让右肩到右腕正好 MAN.reach（胳膊微弯：揉面时胳膊基本是直的，靠上身压）；
// 右手往前探的时候上身往左拧（右肩往前、左肩往后，最多 MAN.twist°），左胳膊不至于被挤成一团。肘尖往外、略往下（肩压低了，肘再往下就扎进台面）；左肘多往下一点，左胳膊从左下角进。
const MAN = { x: .03, w: .20, reach: .55, z: [.46, .68], drop: .10, twist: 20, poleR: [1, -.3, 0], poleL: [-.7, -.5, 0] };
const TB = Math.tan((CAM.pitch + CAM.fov / 2) * D2R), WR = new THREE.Vector3(), WL = new THREE.Vector3();
// 伸到远边的四张（伸、勾、折、压）：手在面团远端、抬得高，右肩照常摆的话胳膊几乎拉直，前臂顺着面团右边从右上斜压下来、还占一大块窗。
// 这几张右肩往右挪 5 cm、往台里挪 8 cm（off，米；仍在画框右下外），肘往右、往下、略往里沉（pole）→ 前臂从右边斜着进来，
// 面团右边和前臂之间露出一条台面。挪 10 / 15 cm 时缝更宽，但前臂转到背光、整条变暗，每拍闪一次（见 stills/r6/s3-reach、s3-light）。左胳膊、其余各张不动。
const FAR = { off: [.05, 0, -.08], pole: [1, -.4, -.2] };
function arms(s, far) {
  const { R, L } = s.hands; R.root.updateMatrixWorld(true); L.root.updateMatrixWorld(true); R.B.wrist.getWorldPosition(WR); L.B.wrist.getWorldPosition(WL);
  const a = Math.min(MAN.twist, Math.max(-8, (WL.z - WR.z) * 100)) * D2R;
  const at = (zc, sd) => { const z = zc - sd * MAN.w * Math.sin(a); return [MAN.x + sd * MAN.w * Math.cos(a), CAM.p[1] - (CAM.p[2] - z) * TB - MAN.drop, z]; };
  let lo = MAN.z[0], hi = MAN.z[1];
  for (let k = 0; k < 20; k++) { const m = (lo + hi) / 2, q = at(m, 1); if (Math.hypot(q[0] - WR.x, q[1] - WR.y, q[2] - WR.z) < MAN.reach) lo = m; else hi = m; }
  const zc = (lo + hi) / 2;
  const sR = at(zc, 1); if (far) for (let j = 0; j < 3; j++) sR[j] += FAR.off[j];
  R.reachArm(sR, { pole: far ? FAR.pole : MAN.poleR });
  L.reachArm(at(zc, -1), { pole: MAN.poleL });
}
// 绕面团中心（竖轴）转 a 弧度
const rotY = ([x, y, z], a) => [x * Math.cos(a) + z * Math.sin(a), y, -x * Math.sin(a) + z * Math.cos(a)];

function act(s, lt) {
  const n = Math.floor(lt * 12 + 1e-6), beat = Math.min(3, Math.floor(n / 9)), i = Math.min(8, n - beat * 9), last = beat === 3;
  const st = { ...DSEQ[i], seam: beat > 0, hx: .045, hz: HZ[Math.min(i, 2)] }, yw = (st.turn || 0) * Math.PI / 2;
  st.yaw = yw; doughGeo(st, s.dough.geometry); dust(s);
  const g = s.dough.geometry;
  // 右手
  if (i <= 2) place(s.hands.R, 'push', [.045, topAt(g, .045, HZ[i] + .01) + .004, HZ[i]], 4, 10, -8);
  else if (i <= 6) {
    const tip = xf(.3, -.02, -.95, { ...st, yaw: 0 }, [0, 0, 0]), pt = [-40, -40, -30, -14][i - 3], pz = pitchOff(pt);
    place(s.hands.R, i === 3 ? 'reach' : i === 6 ? 'press' : 'hook', [tip[0], tip[1] + pz[0], tip[2] + pz[1]], pt, 10, -6);
  } else if (last) { const p = rotY([.065, 0, 0], yw * .3); place(s.hands.R, 'press', [p[0], topAt(g, p[0], p[2]) + .004, p[2]], 2, 10 + yw / D2R * .4, -8); }
  else place(s.hands.R, 'ready', i === 7 ? [.07, .135, .12] : [.055, .125, .09], 12, 8, -8);
  // 左手：扶住左肩；转的两张扣住左侧带着面团转（手在面上滑：位置只跟 35%，不挡到面团前面）
  const lp = rotY([-.1, 0, .02], yw * .35), ly = topAt(g, lp[0] + .012 * Math.cos(yw * .35), lp[2]);
  place(s.hands.L, i >= 7 ? 'grip' : 'hold', [lp[0], Math.max(.03, ly * .82), lp[2]], -6, -10 + yw / D2R * .3, 38);
  arms(s, i >= 3 && i <= 6);
  return { st, beat, i };
}
const MO = new THREE.Object3D(), NV = new THREE.Vector3();
function dust(s) {
  const g = s.dough.geometry, a = g.attributes.position.array, nm = g.attributes.normal.array;
  s.specks.userData.ids.forEach(([i, r], k) => {
    NV.set(nm[i * 3], nm[i * 3 + 1], nm[i * 3 + 2]); MO.position.set(a[i * 3], a[i * 3 + 1], a[i * 3 + 2]).addScaledVector(NV, .0007);
    MO.lookAt(MO.position.x + NV.x, MO.position.y + NV.y, MO.position.z + NV.z); MO.scale.setScalar(r); MO.updateMatrix(); s.specks.setMatrixAt(k, MO.matrix);
  });
  s.specks.instanceMatrix.needsUpdate = true;
}
// 勾着远边的手：弯起来的指尖在手框里约 (0, -.03, -.075)，手框原点 = 指尖 + R·(0, .03, .075)
function pitchOff(pt) { const a = pt * D2R; return [.03 * Math.cos(a) - .075 * Math.sin(a), .03 * Math.sin(a) + .075 * Math.cos(a)]; }

function thud(g, cam, k) {   // 每拍「咚」：面团底两侧各一小团粉，2 张（2D 叠在三维上，位置由面团底两侧投到画面）
  const al = k ? .55 : 1, col = mix(C('flour').f, SNOWLIGHT_RIM, .25), v = new THREE.Vector3();
  g.save(); g.globalAlpha = al;
  for (const dir of [-1, 1]) {
    v.set(dir * (DR + .012), .004, .03).project(cam); const x0 = (v.x + 1) / 2 * W, y0 = (1 - v.y) / 2 * H;
    for (let j = 0; j < 3; j++) {
      const cx = x0 + dir * (10 + j * 22 + k * 16), cy = y0 - 6 - j * 9 - k * 8, r = (k ? 26 : 19) * (1 - j * .2);
      cel(g, [[cx - r, cy], [cx - r * .4, cy - r * .9], [cx + r * .5, cy - r * .8], [cx + r, cy], [cx, cy + r * .5]], { f: col, s: mix(col, C('dough').s, .4), so: [0, -r * .3] });
    }
  }
  g.restore();
}

let MK = null, T1 = null, T2 = null;
const fresh = x => { x.setTransform(1, 0, 0, 1, 0, 0); x.globalCompositeOperation = 'source-over'; x.globalAlpha = 1; x.clearRect(0, 0, W, H); };
export function draw(g, e, lt, A, t) {
  for (const x of [g, e]) { x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over'; x.filter = 'none'; }
  const pl = plate();
  g.drawImage(pl.c, 0, 0); e.drawImage(pl.e, 0, 0);
  A?.mods?.fx?.snow?.(g, e, t, { layers: ['far', 'mid'], clip: pl.P, lamp: [LAMP[0], LAMP[1], 170], glass: true, seed: 5 });
  g.drawImage(pl.f, 0, 0); e.drawImage(pl.fe, 0, 0);
  const s = setup();
  const k = act(s, lt);
  MK = MK || canvas(W, H); T1 = T1 || canvas(W, H); T2 = T2 || canvas(W, H);
  const [mc, mx] = MK, [c1, x1] = T1, [c2, x2] = T2; fresh(mx);
  draw3d(g, mx, s.scene, s.cam);                                       // 颜色层 ← 三维；mx ← 前景（面团、手、袖）的黑剪影
  // 窗外冷光：剪影里离上沿 3.5 px、离两侧 2.5 px 以内的一圈 = 雪光蓝轮廓（只在整组前景的外轮廓上，不在手和面团互相挡的地方）
  fresh(x2); x2.drawImage(mc, -2.5, 3.5); x2.globalCompositeOperation = 'destination-in'; x2.drawImage(mc, 2.5, 3.5);
  fresh(x1); x1.drawImage(mc, 0, 0); x1.globalCompositeOperation = 'source-in'; x1.fillStyle = SNOWLIGHT_RIM; x1.fillRect(0, 0, W, H);
  x1.globalCompositeOperation = 'destination-out'; x1.drawImage(c2, 0, 0);
  x1.clearRect(0, 0, 5, H); x1.clearRect(W - 5, 0, 5, H); x1.clearRect(0, H - 6, W, 6);   // 出画的地方不是轮廓
  g.drawImage(c1, 0, 0);
  e.drawImage(mc, 0, 0);                                                // 剪影挡住发光板上的窗光
  if (k.i < 2) thud(g, s.cam, k.i);
  return {};
}
