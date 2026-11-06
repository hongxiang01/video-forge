// 姿势原画（第 7 版方向）：豆包按同一角色画连续姿势（一张图 4 个），切成单张（design/poses/cut_sheet.py），
// 镜头里按时间换张——像黑板定格动画。人物整张来自同一张画：头、身子、四肢、道具天然一致，不靠掰关节。
// design/poses/poses.json：{ id: { src, ax, ay, k } }，(ax, ay) 是这张画上的锚点（像素），k 是每像素多少世界单位。
import { characterLayers, applyCam } from './main.js';

export const POSE = {};
// 预演（PROBE）那一遍只算位置不画：film.js 在预演前后调 setProbing
let PROBING = false;
export const setProbing = (v) => { PROBING = v; };
const load = (f) => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error('load ' + f)); i.src = f; });
export async function loadPoses(url = 'design/poses/poses.json') {
  const J = await (await fetch(url)).json();
  await Promise.all(Object.entries(J).map(async ([id, p]) => { POSE[id] = { ...p, img: await load(p.src) }; }));
}

// 时间表 [[t, id], …] → 当前这张、上一张、换张后过了多久
export function seqAt(seq, t) {
  let i = 0;
  while (i + 1 < seq.length && t >= seq[i + 1][0]) i++;
  return { id: seq[i][1], prev: i ? seq[i - 1][1] : null, dt: t - seq[i][0], i };
}

// 画一张：锚点放到世界坐标 (P.x, P.y)。P.scale、P.face（-1 左右翻）、P.rot、P.alpha、P.breath（竖向微缩放，呼吸）、P.clipX1（只画世界 x 小于它的部分）
// 画进动态层：和场景里的粉笔线一样每 2 帧换一套颗粒遮罩，静止时线条也在"呼吸"
export function drawPose(api, id, P = {}) {
  if (PROBING) return;
  const p = POSE[id];
  if (!p) throw new Error('no pose ' + id);
  const s = (P.scale ?? 1) * p.k, f = P.face ?? 1, w = p.img.width, h = p.img.height;
  if (P.ghost) {   // 换张残影：直接画在黑板上，只取比黑板亮的部分（lighten），淡淡一层
    const c = api.board; c.save(); applyCam(c); c.globalCompositeOperation = 'lighten'; c.globalAlpha = P.alpha ?? 0.15;
    c.translate(P.x, P.y ?? 0); c.rotate(P.rot ?? 0); c.scale(s * f * (P.sx ?? 1), s * (1 + (P.breath ?? 0)));
    c.drawImage(p.img, -p.ax, -p.ay); c.restore(); return;
  }
  const sxa = Math.abs(P.sx ?? 1), x0 = P.x - Math.max(p.ax, w - p.ax) * s * sxa - 20, x1 = P.x + Math.max(p.ax, w - p.ax) * s * sxa + 20;   // 横向拉伸也要算进绘制范围
  const y0 = (P.y ?? 0) - p.ay * s * 1.1 - 20, y1 = (P.y ?? 0) + (h - p.ay) * s * 1.1 + 20;
  const G = characterLayers(api, [x0, y0, x1, y1]), c = G.back.fill;
  c.save();
  if (P.clipX1 != null) { c.beginPath(); c.rect(-1e6, -1e6, P.clipX1 + 1e6, 2e6); c.clip(); }
  c.translate(P.x, P.y ?? 0);
  c.rotate(P.rot ?? 0);
  c.scale(s * f * (P.sx ?? 1), s * (1 + (P.breath ?? 0)));
  c.globalAlpha = P.alpha ?? 1;
  c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
  c.drawImage(p.img, -p.ax, -p.ay);
  c.restore();
  G.flush();
}

// 长条（河）：一张画左右镜像拼接成任意长（接缝处镜像对称，看不出），P.flow 让它整体缓慢流动；
// P.reveal 0..1 从左往右画出来；锚点 (ax, ay) 的 y 对到世界 y
export function drawStrip(api, id, x0, x1, y, P = {}) {
  if (PROBING) return;
  const p = POSE[id];
  if (!p) throw new Error('no pose ' + id);
  const s = (P.scale ?? 1) * p.k, tw = p.img.width * s, rx1 = x0 + (x1 - x0) * (P.reveal ?? 1);
  if (rx1 <= x0) return;
  const off = (((P.flow ?? 0) % (2 * tw)) + 2 * tw) % (2 * tw);
  const G = characterLayers(api, [x0 - 20, y - p.ay * s - 40, rx1 + 20, y + (p.img.height - p.ay) * s + 40]), c = G.back.fill;
  c.save(); c.beginPath(); c.rect(x0, y - 1e4, rx1 - x0, 2e4); c.clip();
  c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high'; c.globalAlpha = P.alpha ?? 1;
  for (let j = 0, x = x0 - off; x < rx1; j++, x += tw) {
    c.save(); c.translate(x, y + (P.bob ? P.bob(j) : 0));
    if (j % 2) { c.translate(tw, 0); c.scale(-s, s); } else c.scale(s, s);
    c.drawImage(p.img, 0, -p.ay); c.restore();
  }
  // 两端、正在画出来的那条边都做渐隐（不留一刀切的直边）
  const yt = y - p.ay * s - 40, hh = p.img.height * s + 80;
  const fade = (xa, xb) => { const g = c.createLinearGradient(xa, 0, xb, 0); g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(Math.min(xa, xb), yt, Math.abs(xb - xa), hh); };
  c.globalAlpha = 1; c.globalCompositeOperation = 'destination-out';
  if (P.fadeL) fade(x0, x0 + P.fadeL);
  if (P.soft && (P.reveal ?? 1) < 1) fade(rx1, rx1 - P.soft);
  if (P.fadeR && rx1 >= x1 - 1) fade(x1, x1 - P.fadeR);
  c.globalCompositeOperation = 'source-over';
  c.restore(); G.flush();
}

// 长条在世界 x 处的上缘高度（世界 y）：船贴着画里真实的浪尖漂（和 drawStrip 同样的拼接、流动算法）
export function stripTop(id, x0, y, xw, P = {}) {
  const p = POSE[id], s = (P.scale ?? 1) * p.k, tw = p.img.width * s, off = ((((P.flow ?? 0) % (2 * tw)) + 2 * tw) % (2 * tw));
  const u = xw - (x0 - off), j = Math.floor(u / tw); let lx = u - j * tw;
  if (((j % 2) + 2) % 2) lx = tw - lx;
  const f = lx / s / p.topStep, i = Math.max(0, Math.min(p.tops.length - 2, Math.floor(f))), r = f - i;
  return y + ((p.tops[i] * (1 - r) + p.tops[i + 1] * r) - p.ay) * s;
}

// 换张时上一张留一点擦痕残影（粉笔定格动画的味道）：先画淡的上一张，再画这一张
export function drawSeq(api, seq, t, P = {}, ghost = 0.16) {
  const q = seqAt(seq, t);
  if (q.prev && q.dt < ghost) drawPose(api, q.prev, { ...P, ...(P.prevP || {}), alpha: (P.alpha ?? 1) * 0.28 * (1 - q.dt / ghost) });
  drawPose(api, q.id, P);
  return q;
}
