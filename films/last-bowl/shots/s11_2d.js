// S11 —— 同 S10 构图（接横摇终点 −16 px），回到平涂：空碗，筷子横搁在碗口，台面上三枚硬币，没有热气（锅已关火）。
// 30.0–30.75 全片第一次真静默，画面一动不动；32.25 师傅的右手从左入画（一拍两格 3 张，手指边走边收拢），32.50 停在碗边 9 个输出帧：
// 四指虚靠在碗壁上、拇指悬在碗沿上方（犹豫这一下）；32.875 拇指压上碗沿（连筷子一起压住）、四指扣紧碗壁，碗离台，按 24 帧往左上端走，
// 33.0 在动作中切走（接 S12 往左的跟摇）。碗离台后台面上露出一圈淡淡的碗底水印（S12 开头那一圈）。
// 构图和碗的画法从 s10.js import（s10 改了这里跟着变）；手型是这个镜头自己摆的「端碗」，用 hands.js 的积木搭（粗剪第 2 轮）。
import { canvas, cel, mix, rgba, W, H } from '../lib/cel.js';
import { C } from '../pal.js';
import { hand, digit, part, backOfHand, FW, FWK } from '../hands.js';
import { L, drawBowl, bowlBody, backdrop, toScreen, q12 } from './s10.js';

const D = Math.PI / 180, DX = -16;                       // 接 S10 横摇终点
const lerp = (a, b, u) => a + (b - a) * u;

// 筷子：两根横搁在碗口上，左头只探出碗沿一点（师傅的拇指从这边压上来），右头往老主顾那边伸出去（设计坐标，跟着碗走）
function chopsticks(g, bx, ry) {
  const k = C('pin');
  for (const [y0, y1, sx] of [[-20, -9, 0], [-13, -3, 14]]) {
    const a = [bx - 286 + sx, ry + y0], b = [bx + 290 + sx, ry + y1], w0 = 5.5, w1 = 3.6;
    cel(g, [[a[0], a[1] - w0, 1], [b[0], b[1] - w1, 1], [b[0], b[1] + w1, 1], [a[0], a[1] + w0, 1]], { f: k.f, s: k.s, sh: [[[a[0], a[1] + 1], [b[0], b[1] + 1], [b[0], b[1] + w1 + 1], [a[0], a[1] + w0 + 1]]], l: k.l, lw: 1.6 });
  }
}
// 硬币：三枚平放在台面上（老主顾那一侧），薄椭圆 + 硬边高光；一枚叠在另一枚上
function coins(g, bx) {
  const m = C('basin'), y = L.B0;
  // 粗剪第 2 轮：原来 17 px 的币在 720p 上只剩三个白点 → 放大到 22 px、币边加厚到 3 px，读得出是三枚分币
  for (const [x, dy, r] of [[bx + 330, -2, 22], [bx + 378, 4, 21], [bx + 352, -8, 22]]) {
    const cy = y + dy, ry = r * .24;
    g.fillStyle = '#5A3A3E'; g.beginPath(); g.ellipse(x + 10, cy + 3, r + 3, ry + 1, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = m.s; g.beginPath(); g.ellipse(x, cy + 3, r, ry, 0, 0, Math.PI * 2); g.fill();     // 币边（厚 3 px）
    g.strokeStyle = m.l; g.lineWidth = 1.4; g.stroke();
    g.fillStyle = m.f; g.beginPath(); g.ellipse(x, cy, r, ry, 0, 0, Math.PI * 2); g.fill(); g.stroke();
    g.strokeStyle = m.s; g.lineWidth = 1.1; g.beginPath(); g.ellipse(x, cy, r * .62, ry * .62, 0, 0, Math.PI * 2); g.stroke();   // 币面一圈压印
    g.fillStyle = '#FFF4DC'; g.fillRect(x - r * .6, cy - ry * .5, r * .45, 1.8);                 // 灯在左上：左边一道硬高光
  }
}
// 碗底水印：碗离台后留在台面上的一圈湿印（侧拍里压成很扁的椭圆），k = 显出来的程度
function waterRing(g, bx, k) {
  if (k <= 0) return;
  const y = L.B0 - 1;
  g.strokeStyle = rgba('#3A2418', .42 * k); g.lineWidth = 3.4; g.beginPath(); g.ellipse(bx, y, 100, 5.5, 0, 0, Math.PI * 2); g.stroke();
  g.strokeStyle = rgba('#E0A868', .55 * k); g.lineWidth = 1.3; g.beginPath(); g.ellipse(bx, y - 2, 98, 5, 0, Math.PI * 1.08, Math.PI * 1.5); g.stroke();   // 灯在左上：水印远侧左段一小道亮边
}

// 碗离台：drawBowl 自带的投影会跟着碗飘起来 → 抬起后把碗画进离屏层、按碗的外形裁掉投影，投影另画在台面上
const [BC, bc] = canvas(W, H), [MC, mc] = canvas(W, H);
const clear = x => { x.setTransform(1, 0, 0, 1, 0, 0); x.globalCompositeOperation = 'source-over'; x.globalAlpha = 1; x.clearRect(0, 0, W, H); };
function liftedBowl(g, M, bx, ry, lift) {
  g.save(); g.setTransform(M);                                       // 投影留在台面上：碗越高越小、越淡，往右（灯在左上）
  g.fillStyle = rgba('#5A3A3E', Math.max(.25, 1 - lift / 60)); g.beginPath(); g.ellipse(bx + 70 + lift * .5, L.B0 - 2, 175 - lift * .6, 13 - lift * .08, 0, 0, Math.PI * 2); g.fill();
  g.restore();
  clear(bc); bc.setTransform(M); drawBowl(bc, bx, ry, { empty: true });
  clear(mc); mc.setTransform(M); mc.fillStyle = mc.strokeStyle = '#000'; mc.lineWidth = 8;
  const body = bowlBody(bx, ry), base = ry + L.h + L.foot; mc.fill(body); mc.stroke(body);
  mc.beginPath(); mc.moveTo(bx - 108, ry + L.h - 8); mc.lineTo(bx + 112, ry + L.h - 8); mc.lineTo(bx + 104, base + 2); mc.lineTo(bx - 102, base + 2); mc.closePath(); mc.fill();
  mc.beginPath(); mc.ellipse(bx, ry, L.rx + 6, L.ery + 6, 0, 0, Math.PI * 2); mc.fill();
  bc.setTransform(1, 0, 0, 1, 0, 0); bc.globalCompositeOperation = 'destination-in'; bc.drawImage(MC, 0, 0); bc.globalCompositeOperation = 'source-over';
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(BC, 0, 0); g.restore();
}

// —— 端碗手型（师傅右手，手背朝镜头、拇指在上，前臂从左边稍高处伸过来）——
// 直接在「碗口坐标」里摆：原点 = 碗口中心，x 往右、y 往下，单位 = 掌宽（碗口半径 = 1，碗高 0.92）。
// hand() 用 rot = 90°，所以本地点 = [y, −x]、本地角 = 屏幕角 − 90°。c = 收拢：0 = 伸过来时手指松着、拇指翘起；1 = 扣住。
// 每根手指在干什么（c = 1）：拇指压在碗沿（和筷子）上，末节往下扣；食指贴着红沿下面横着扣住碗壁；中指斜着托在碗壁中段；
// 无名指往碗肚下面收；小指勾到碗肚底下（指尖藏在圈足旁边）。四指越往下越弯，后两节绕到碗壁里侧，看上去一节比一节短。
const P = ([x, y, k]) => k ? [y, -x, k] : [y, -x], A = a => a - 90;
// [指根, [三节屏幕角：松, 扣], [三节可见长：松, 扣]]
// 粗剪第 3 轮：第 2 版四指等距、几乎平行（像耙子），每根都是直的。现在：
//   指根连成一道往右鼓的弧（中指骨节最靠前），间距不等（.19 / .16 / .15）；
//   松的时候每个关节也微微弯（6–12°），四根各自的角度不同、略张开；扣住时顺着碗壁包过去，越往下弯得越狠，
//   食指贴着红沿下面、中指斜托碗壁中段、无名指往碗肚下收、小指勾到碗肚底下（末两节往碗里绕，看上去一节比一节短）
const FING = {
  i: [[-.985, .10], [[-14, -6, 4], [-5, 6, 22]], [[.28, .18, .13], [.28, .16, .10]]],    // 食指：和中指分开一点，贴着红沿下面，末节往碗里绕（缩短）
  m: [[-.95, .30], [[4, 11, 22], [13, 27, 46]], [[.32, .21, .15], [.31, .19, .12]]],     // 中指最长、伸得最远（指尖排成一道弧，不在一条竖线上）
  r: [[-.955, .455], [[12, 22, 34], [24, 42, 66]], [[.28, .18, .13], [.26, .15, .09]]],  // 无名指挨着中指（中、无名、小指三根并拢成一组）
  l: [[-.90, .595], [[30, 42, 56], [50, 70, 92]], [[.21, .14, .10], [.15, .08, .05]]],   // 小指弯得最狠，勾到碗肚底下
};
// 手背：指根一排在碗壁左缘上，腕在左边、比指根低一点（腕往上翘着托住手：手轴朝右上 ~8°，前臂从左上斜下来 ~20°，腕上折出一个角）
const BACK = [[-1.03, -.01], [-.94, .05], [-.88, .20], [-.89, .38], [-.86, .53], [-.84, .66], [-.90, .77], [-1.10, .86], [-1.36, .88], [-1.62, .87, 1], [-1.72, .29, 1], [-1.55, .14], [-1.36, .03], [-1.18, -.03]];
function takePose(c) {
  return () => {
    // 拇指：根在虎口上方，近节往右上斜立，指间关节往下扣（松 20° → 扣 50°），指肚压上碗沿（连筷子）
    const thumb = digit(P([-1.33, .03]), [lerp(-50, -40, c), lerp(-30, 14, c)].map(A), [.30, lerp(.23, .25, c)], { w: .27, nail: true, back: true, id: 21 });
    const palm = part('skin', ['W', ...BACK.map(P)], { cal: [[[-1.24, -.04], [-1.06, -.01], [-1.08, .05], [-1.22, .03]].map(P)] });   // 虎口老茧：从手背只看到边上一条
    backOfHand(palm, ['l', 'r', 'm', 'i'].map(f => P(FING[f][0])), P([-1.64, .58]), 11);
    const fing = ['l', 'r', 'm', 'i'].map((f, j) => {                // 小指先画，食指压在最上
      const [b, an, ln] = FING[f];
      return digit(P(b), an[0].map((a, k) => A(lerp(a, an[1][k], c))), ln[0].map((l, k) => lerp(l, ln[1][k], c)), { w: FW * FWK[f], back: true, id: 30 + j, cal: f === 'i' ? -1 : 0 });
    }).flat();
    return { arm: { w: P([-1.70, .58]), a: A(200) }, parts: [...thumb, palm, ...fing] };   // 拇指根藏在手背后面（掌心一侧）
  };
}
// 前臂：袖子从腕往左上走 0.9 掌宽（到画框边上）后在肘处再往上折 14°（不是一根直管）
const ELBOW = { at: .9, a: 200 - 90 + 14, len: 3 };
function masterTake(g, M, x, y, c) {
  g.save(); g.setTransform(M);
  hand(g, null, { x, y, s: L.s, rot: 90 * D, side: 'R', pose: takePose(c), light: 'warm', arm: 3.2, lw: 1.6, elbow: ELBOW });
  g.restore();
}

// —— 时间线（lt 0–3）——
// 入画 3 张 + 停：[手相对「扣住」位置的偏移 x, y（掌宽）, 收拢 c]。从左边稍高处弧线落到碗边，手指边走边收
// 停的那一张离「扣住」只差拇指落下 0.08 掌宽、四指再收一点 → 32.875 换张时是一个小动作，不跳
const KEYS = [[-1.95, -.24, 0], [-.88, -.18, .25], [-.26, -.12, .5], [-.03, -.08, .7]];
// 端起（32.875 起按 24 帧）：碗的位移 [x, y]（设计 px），往左上走
const LIFT = [[0, -2], [-6, -13], [-20, -34]];
export function draw(g, e, lt, A_, t) {
  const M = toScreen(DX), bx0 = L.bx, ry0 = L.ry;
  let k = null, ox = 0, oy = 0;
  if (lt >= 2.875 - 1e-6) { const f = Math.min(2, Math.round((lt - 2.875) * 24)); [ox, oy] = LIFT[f]; k = [0, 0, 1]; }
  else if (lt >= 2.25 - 1e-6) k = KEYS[Math.min(3, Math.floor((q12(lt) - 2.25) * 12 + 1e-6))];
  const bx = bx0 + ox, ry = ry0 + oy, lift = -oy;
  g.save(); g.translate(DX, 0); backdrop(g); g.restore();
  g.save(); g.setTransform(M); coins(g, bx0); waterRing(g, bx0, Math.min(1, lift / 12)); g.restore();
  if (lift > 0) liftedBowl(g, M, bx, ry, lift);
  else { g.save(); g.setTransform(M); drawBowl(g, bx, ry, { empty: true }); g.restore(); }
  g.save(); g.setTransform(M); chopsticks(g, bx, ry); g.restore();
  if (k) masterTake(g, M, bx + k[0] * L.s, ry + k[1] * L.s, k[2]);
  return {};
}
