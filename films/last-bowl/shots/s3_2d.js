// S3（6.0–9.0 s）近景 · 台面高度微仰 · 固定：逆光半剪影揉面。6.00 / 6.75 / 7.50 / 8.25 每拍一推：推出 → 折回 → 转（TREATMENT §4 / §5，CONTINUITY S2→S3、S3→S4）
// 粗剪第 2 轮：背景换成 A 里那扇窗（三格、两道窗棂、玻璃上反写「手擀面」、窗顶卷帘门卷筒、右格路灯金光、窗台外一道雪埂），从台面高度看过去；
// 台面灯圈偏左（吊灯在左上）。手型自己摆（backHand：手背朝镜头、往窗那边伸），不再借现成手型压扁。
// 半剪影：左手 → 面团 → 右手先按暖灯色画进离屏，再整块乘成暖灯阴影，只在顶面留一窄条 lit；朝上 / 朝两侧的边勾 2–4 px 雪光蓝 #9CC8FF。
// 第四拍收在「转」上（面团转过来、双手还按在面上），9.00 切 S4 正俯推杖。
import { cel, rgba, mix, rng, hash, airbrush, vgrad, canvas, TAU, W, H } from '../lib/cel.js';
import { C, SNOWLIGHT_RIM, BG, SNOW, LIGHT } from '../pal.js';
import { digit, part, backOfHand, FW, FWK } from '../hands.js';
import { FONT } from '../plates.js';

const f12 = t => Math.floor(t * 12 + 1e-6) / 12;
const DOUGH = C('dough'), FLOUR = C('flour');
const HOR = 690, YB = 792;                                   // 台面远沿（墙脚）、面团底线
// 窗：layout.WIN（宽 1.6 m、高 0.75 m、窗棂 ±0.27 宽 4 cm）按 750 px/m 正面摆进画面，窗台 y 640、窗顶 y 70
const WX = X => 960 + X * 750, WY = Y => 640 - (Y - 1.10) * 760;
const WIN = { x0: WX(-.8), x1: WX(.8), y0: WY(1.85), y1: WY(1.10), mull: [-.27, .27].map(m => [WX(m - .02), WX(m + .02)]) };
const ROLL = 36;                                             // 卷帘门卷在窗上沿（A 里 14 px；这里离得近、往上看）
const LAMP = [WX(.64), WIN.y0 + ROLL + 34];                  // 路灯：在右格右上、紧挨卷筒下面的一团金光
const LETTERS = [['面', WX(-.535)], ['擀', WX(0)], ['手', WX(.535)]], LET = { top: WY(1.42), s: .22 * 760 };
const SHADE_MUL = '#9C8096';                                 // 暖灯 lit → shadow 的乘数（皮肤 #D9A07A → #9C6250）

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

// —— 面团侧影：底边平贴台面，顶上一条鼓起的弧。S = { xl, xr, h, sk 峰位, fold 折回的唇 } ——
function doughPts(S, seed) {
  const pts = [[S.xl, YB, 1]];
  for (let i = 1; i < 18; i++) { const u = i / 18, w = Math.pow(Math.sin(Math.PI * Math.pow(u, S.sk)), .4); pts.push([S.xl + (S.xr - S.xl) * u, YB - S.h * w + (hash(i + seed) - .5) * 12]); }
  pts.push([S.xr, YB, 1]);
  return pts;
}

// —— 手型：手背朝镜头、往窗那边伸（本地：掌宽 = 1，y 向下，前臂从 +y 来）。左手用同一套、side 'L' 镜像 ——
// 四指（小 → 食）[根节角°, 二节再弯°, 三节再弯°, 三节可见比例]：手背贴着看，指头搭在面团上越往前越缩短
// 粗剪第 3 轮（第 2 版像两只竖起来的耙子 / 爪子）：四指每个关节都弯一点（5–20°）、往中指一侧收，张开的角度和间隔各不相同，
// 指根骨节一道弧、间距不等；拇指根落在掌的桡侧边上（掌外形鼓出第一掌骨，虎口软弧接到食指根），斜着伸、和食指之间留开 V；
// wa = 前臂方向（本地°）：比 90 小 = 腕往小指一侧折（尺偏），前臂斜着从下角进来；前臂在画框下沿附近再折一点（elbow），不是一根直管
const DG = Math.PI / 180, FN = ['l', 'r', 'm', 'i'], FL = { l: .50, r: .63, m: .68, i: .62 }, PH = [.45, .30, .25];
const MCP = [[.34, -.37], [.14, -.47], [-.09, -.51], [-.33, -.45]];
const PALM = [[-.46, -.43], [-.28, -.51], [-.08, -.55], [.13, -.52], [.33, -.45], [.48, -.33], [.53, -.04], [.48, .28], [.37, .54, 1], [-.31, .56, 1], [-.46, .34], [-.60, .14], [-.66, -.02], [-.62, -.16], [-.55, -.30]];
const WEB = [[-.66, -.20], [-.65, -.02], [-.58, -.04], [-.58, -.14], [-.56, -.22]];
function backHand(q) {   // q = { fy 掌的纵向透视, wa 前臂方向°, f: 四指, th: [x, y, 角1, 角2, 长1, 长2] 拇指, seed }
  const Y = p => p.length > 2 ? [p[0], p[1] * q.fy, p[2]] : [p[0], p[1] * q.fy];
  const palm = part('skin', ['W', ...PALM.map(Y)], { cal: [WEB.map(Y)] }), mcp = MCP.map(Y);
  backOfHand(palm, mcp, [.02, .50 * q.fy], q.seed);
  const fing = [];
  FN.forEach((f, i) => {
    const [a, b1, b2, ...k] = q.f[i], angs = [a, a + b1, a + b2], ls = PH.map((p, j) => FL[f] * p * k[j]), n = ls.filter(l => l > .012).length;
    fing.push(...digit(mcp[i], angs.slice(0, n), ls.slice(0, n), { w: FW * FWK[f], back: true, nail: n === 3, id: i + q.seed * 4, cal: f === 'i' ? -1 : 0 }));
  });
  const [tx, ty, t1, t2, l1, l2] = q.th, thumb = digit([tx, ty * q.fy], [t1, t2], [l1, l2], { w: .28, nail: true, back: true, id: 9 + q.seed });
  return { arm: { w: [.03, .53 * q.fy], a: q.wa }, parts: [...thumb, palm, ...fing] };
}
const mixQ = (a, b, w) => Array.isArray(a) ? a.map((v, i) => mixQ(v, b[i], w)) : typeof a === 'number' ? a + (b - a) * w : a;
// 手背看过去，手指往掌心蜷 = 往画面里扎 → 主要表现为可见长度变短；侧向再弯 5–20°（往中指一侧收），四根各不相同。
// 台面高度看过去，平按在面顶上的手掌和顺着面顶往前搭的手指都是贴着视线的 → 掌（fy）和指（可见比例）都压得很短，读得出「压在上面」
// 搭在面顶上的手指顺着面顶弯过去、往远处走：末节翻到面顶后面看不见（可见比例 < .07 → 只画两节、不出指甲），指头停在面团的顶线附近，
// 不再竖着露出三节带指甲的指头（第 2 版读成举在面团前面的爪子）
// push 掌根推出去：四指扇开搭在面顶、小指张得最开最弯；fold 腕抬起，近节搭过面顶、只露到 PIP 骨节，四指往一处收拢；
// turn 右手松开抬一点，指头放平（三节露出来）；hold 左手扶住左侧面，扇开不等；grip 左手转面团：四指往面里扣（更缩短、更弯）
// 拇指根在掌的桡侧边上（[-.58, .08–.10]），贴着面团近侧斜着往前、和食指之间留 V；够长（.27 + .20）但不往另一只手那边横伸（两只拇指不在中间碰头）
const Q = {
  push:  { fy: .50, wa: 70, seed: 3, f: [[-67, -12, -26, .46, .30, .05], [-82, -7, -14, .52, .34, .06], [-94, 3, 8, .54, .36, .06], [-106, 9, 18, .50, .32, .05]], th: [-.58, .08, -118, -100, .27, .20] },
  fold:  { fy: .78, wa: 72, seed: 3, f: [[-71, -16, 0, .50, .16, 0], [-84, -9, 0, .56, .17, 0], [-95, 4, 0, .58, .18, 0], [-106, 12, 0, .54, .17, 0]], th: [-.58, .08, -114, -96, .27, .20] },
  turn:  { fy: .60, wa: 68, seed: 3, f: [[-68, -8, -17, .60, .44, .30], [-82, -4, -9, .66, .48, .34], [-93, 2, 6, .68, .50, .36], [-105, 6, 13, .64, .46, .32]], th: [-.58, .10, -102, -88, .27, .20] },
  hold:  { fy: .56, wa: 70, seed: 4, f: [[-64, -11, -24, .46, .30, .05], [-80, -6, -13, .52, .34, .06], [-93, 3, 8, .56, .36, .06], [-105, 9, 19, .50, .32, .05]], th: [-.58, .10, -110, -94, .25, .18] },
  grip:  { fy: .70, wa: 72, seed: 4, f: [[-72, -16, -34, .46, .22, .05], [-85, -10, -21, .52, .24, .05], [-95, 4, 9, .54, .26, .05], [-106, 11, 23, .52, .25, .05]], th: [-.58, .10, -104, -90, .24, .17] },
};
Q.ready = mixQ(Q.turn, Q.push, .5);
// 关键形：K1 推出（面团压扁、往前摊开，右手掌根在面上）；K2 折回（右手勾着远边拉回来，面团鼓起、顶上一道折唇）；K3 转（左手扣着拧，峰位换边）；K0 预备（右手抬起）
// R / L：[x, y, rot, 手型]，锚点 = 掌心；前臂从下角出画（师傅在近侧）。两只手分在面团两侧，中间露出面团的近面
// （第一版两只 300 px 的手并排压在 650 px 的面团上，面团整个被挡住）：掌宽 HS，右手掌根压在面团右上、指尖搭到面顶，左手扶左侧面
// 推 = 往窗那边（画面上方）：K0 预备时右手收回、在低处，K1 拍点上一下推上去；K2 勾住远边往回带（手往下回来一点）；K3 右手松开外撤、左手拧
const HS = 262;
const K = {
  // 第 3 轮：手本身转得少一点（rot），斜的部分交给腕角（wa）和前臂 → 手指朝窗、前臂从下角斜着进来；两手各往外让 20 px，两个拇指不在中间碰头
  K1: { d: { xl: 545, xr: 1375, h: 345, sk: .75, fold: 0 }, R: [1088, 540, -.20, 'push'], L: [680, 616, .38, 'hold'] },
  K2: { d: { xl: 590, xr: 1310, h: 405, sk: 1.0, fold: 1 }, R: [1066, 518, -.10, 'fold'], L: [676, 604, .36, 'hold'] },
  K3: { d: { xl: 575, xr: 1325, h: 412, sk: 1.25, fold: .4 }, R: [1170, 580, -.44, 'turn'], L: [704, 578, .22, 'grip'] },
  K0: { d: { xl: 580, xr: 1320, h: 400, sk: 1.0, fold: .2 }, R: [1138, 616, -.32, 'ready'], L: [686, 610, .36, 'hold'] },
};
const SEQ = [['K1', 'K1', 0], ['K1', 'K1', 0], ['K1', 'K2', .5], ['K2', 'K2', 0], ['K2', 'K2', 0], ['K2', 'K3', .5], ['K3', 'K3', 0], ['K3', 'K3', 0], ['K0', 'K1', .25]];   // 每拍最后一张：收回到低处、推已经起步（中间张），下一拍落在 K1
const LAST = [...SEQ.slice(0, 6), ['K2', 'K3', .8], ['K3', 'K3', 0], ['K3', 'K3', 0]];   // 第四拍收在「转」上
const lerp = (a, b, w) => a + (b - a) * w;
function keyAt(lt) {
  const n = Math.max(0, Math.floor(f12(lt) * 12 + 1e-6)), beat = Math.min(3, Math.floor(n / 9)), i = Math.min(8, n - beat * 9);
  const [a, b, w] = (beat === 3 ? LAST : SEQ)[i], A = K[a], B = K[b], jit = (hash(beat + 7) - .5) * 24;
  const d = {}; for (const k in A.d) d[k] = lerp(A.d[k], B.d[k], w);
  d.xl += jit; d.xr += jit;
  const hnd = s => [lerp(A[s][0], B[s][0], w) + jit, lerp(A[s][1], B[s][1], w), lerp(A[s][2], B[s][2], w), mixQ(Q[A[s][3]], Q[B[s][3]], w)];
  return { d, R: hnd('R'), L: hnd('L'), i, beat };
}

let HC = null, DC = null, T1 = null, T2 = null;
const fresh = x => { x.setTransform(1, 0, 0, 1, 0, 0); x.globalCompositeOperation = 'source-over'; x.globalAlpha = 1; x.clearRect(0, 0, W, H); };
function handIn(x, hd, [hx, hy, rot, q], side) {
  hd(x, null, { x: hx, y: hy, s: HS, rot, pose: () => backHand(q), side, light: 'warm', arm: 3.6, lw: 2, elbow: { at: 1.25, a: q.wa - 16, len: 3 } });   // 前臂在画框下沿附近往外再折 16°
}
function doughIn(x, S, seed) {
  const P = doughPts(S, seed), cx = (S.xl + S.xr) / 2, top = YB - S.h;
  const sh = [], hi = [[[cx - S.h * .9, top + 26], [cx + S.h * .4, top + 8], [cx + S.h * .6, top + 30], [cx - S.h * .6, top + 52]]];
  if (S.fold > .05) {   // 折回来的唇：一道硬边折痕影 + 唇上一条亮
    const fx = lerp(S.xr - 60, cx + 40, S.fold), fy = top + 40 + 60 * S.fold;
    sh.push([[fx - 170, fy + 18], [fx + 10, fy - 14], [fx + 160, fy + 4], [fx + 150, fy + 26], [fx, fy + 10], [fx - 160, fy + 36]]);
  }
  cel(x, P, { f: DOUGH.f, s: DOUGH.s, so: [0, -26], sh, h: FLOUR.f, hi, l: DOUGH.l, lw: 2 });
}
// 整块乘成暖灯阴影，顶上留 (lx, ly) 的 lit；朝上 / 两侧的边勾雪光蓝。手：顶上 16 px；面团单独一遍：吊灯在左上 → 顶上和左边留一大块 lit，
// 面团还是 S2 那团面的奶白色（第一版整团压成灰紫，和 S2 接不上）
function backlit(CV, lx, ly) {
  const [hc, hg] = CV, [c1, x1] = T1, [c2, x2] = T2;
  fresh(x1); x1.drawImage(hc, lx, ly); x1.globalCompositeOperation = 'source-in'; x1.fillStyle = SHADE_MUL; x1.fillRect(0, 0, W, H);
  x1.globalCompositeOperation = 'destination-in'; x1.drawImage(hc, 0, 0);
  hg.save(); hg.setTransform(1, 0, 0, 1, 0, 0); hg.globalCompositeOperation = 'multiply'; hg.drawImage(c1, 0, 0); hg.restore();
  fresh(x2); x2.drawImage(hc, -2.5, 3.5); x2.globalCompositeOperation = 'destination-in'; x2.drawImage(hc, 2.5, 3.5);
  fresh(x1); x1.drawImage(hc, 0, 0); x1.globalCompositeOperation = 'source-in'; x1.fillStyle = SNOWLIGHT_RIM; x1.fillRect(0, 0, W, H);
  x1.globalCompositeOperation = 'destination-out'; x1.drawImage(c2, 0, 0);
  hg.save(); hg.setTransform(1, 0, 0, 1, 0, 0); hg.globalCompositeOperation = 'source-atop'; hg.drawImage(c1, 0, 0); hg.restore();
}
function thud(g, S, k) {   // 每拍「咚」：面团底两侧各一小团粉，2 张
  const al = k ? .55 : 1, sz = k ? 30 : 22, col = mix(FLOUR.f, SNOWLIGHT_RIM, .25);
  g.save(); g.globalAlpha = al;
  for (const [x, dir] of [[S.xl, -1], [S.xr, 1]]) for (let j = 0; j < 3; j++) {
    const cx = x + dir * (14 + j * 26 + k * 18), cy = YB - 8 - j * 10 - k * 8, r = sz * (1 - j * .2);
    cel(g, [[cx - r, cy], [cx - r * .4, cy - r * .9], [cx + r * .5, cy - r * .8], [cx + r, cy], [cx, cy + r * .5]], { f: col, s: mix(col, DOUGH.s, .4), so: [0, -r * .3] });
  }
  g.restore();
}

export function draw(g, e, lt, A, t) {
  for (const x of [g, e]) { x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over'; x.filter = 'none'; }
  const pl = plate();
  g.drawImage(pl.c, 0, 0); e.drawImage(pl.e, 0, 0);
  A?.mods?.fx?.snow?.(g, e, t, { layers: ['far', 'mid'], clip: pl.P, lamp: [LAMP[0], LAMP[1], 170], glass: true, seed: 5 });
  g.drawImage(pl.f, 0, 0); e.drawImage(pl.fe, 0, 0);
  const k = keyAt(lt), hd = A?.mods?.hands?.hand;
  g.fillStyle = rgba('#24141E', .55); g.beginPath(); g.ellipse((k.d.xl + k.d.xr) / 2, YB + 4, (k.d.xr - k.d.xl) * .56, 16, 0, 0, TAU); g.fill();   // 面团压在台面上的影
  HC = HC || canvas(W, H); DC = DC || canvas(W, H); T1 = T1 || canvas(W, H); T2 = T2 || canvas(W, H);
  const [dc, dg] = DC, [hc, hg] = HC; fresh(dg); fresh(hg);
  doughIn(dg, k.d, 11 + k.beat * 5); backlit(DC, 26, 78);
  if (hd) handIn(hg, hd, k.L, 'L');   // 两只手都搭在面团上 → 画在面团前面
  if (hd) handIn(hg, hd, k.R, 'R');
  backlit(HC, 0, 16);
  if (k.i < 2) thud(g, k.d, k.i);   // 粉团在手和面团后面
  g.drawImage(dc, 0, 0); g.drawImage(hc, 0, 0);
  e.save(); e.filter = 'brightness(0)'; e.drawImage(dc, 0, 0); e.drawImage(hc, 0, 0); e.restore();   // 剪影印进发光板
  return {};
}
