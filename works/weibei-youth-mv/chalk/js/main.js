// 合成器：黑板底 → 静态粉笔（lemo 烘焙笔画，能书写、能擦）→ 动态粉笔（人物、移动道具：矢量画再加粉笔颗粒）→ 后期。
import { clamp, lerp } from '/core/lib.js';
import { rng, n1 } from './chalk.js';
import { installDeposit } from './r2d.js';
import { Post } from './post.js';

export const W = 1920, H = 1080;
installDeposit();
const mk = (w = W, h = H) => { const c = new OffscreenCanvas(w, h); return [c, c.getContext('2d')]; };
export const out = document.createElement('canvas'); out.width = W; out.height = H; document.body.appendChild(out);
const [frame, fx] = mk();
const post = new Post(out, W, H);

// ---------- 粉笔颗粒遮罩（屏幕空间，4 套，每 2 帧换一套 = 线条"呼吸"）
function grainMask(seed, kind) {
  const [c, x] = mk(); const img = x.createImageData(W, H), d = img.data, R = rng(seed);
  // 低频斑块 + 高频颗粒；side 是斜向条纹（侧锋），line 是细颗粒（笔尖）
  const blot = new Float32Array(Math.ceil(W / 8) * Math.ceil(H / 8)); for (let i = 0; i < blot.length; i++) blot[i] = R();
  const bw = Math.ceil(W / 8);
  for (let y = 0; y < H; y++) for (let xx = 0; xx < W; xx++) {
    const k = y * W + xx, r = R();
    let a;
    if (kind === 'side') {
      const u = (xx * 0.42 + y * 0.9) / 2.2, v = (xx * 0.9 - y * 0.42) / 30;    // 侧锋：沿 25° 的细条纹
      const st = n1(u + n1(v, seed + 2) * 2.2, seed);
      a = 0.95 + 0.05 * st; if (r < 0.02) a *= 0.35; else if (r < 0.05) a *= 0.75;
    } else {
      a = r < 0.09 ? 0.2 : r < 0.2 ? 0.7 : 1;
    }
    d[4 * k] = d[4 * k + 1] = d[4 * k + 2] = 255; d[4 * k + 3] = Math.round(a * 255);
  }
  x.putImageData(img, 0, 0); return c;
}
const MASKS = { side: [0, 1, 2, 3].map((i) => grainMask(100 + i, 'side')), line: [0, 1, 2, 3].map((i) => grainMask(200 + i, 'line')) };

// ---------- 黑板底（世界坐标，平铺斑驳）
const mott = (() => { const w = 48, h = 28, [c, x] = mk(w, h), img = x.createImageData(w, h), R = rng(5);
  for (let k = 0; k < w * h; k++) { const v = R(); img.data[4 * k] = 30; img.data[4 * k + 1] = 50; img.data[4 * k + 2] = 40; img.data[4 * k + 3] = Math.round(clamp((v - 0.2) / 0.7) * 0.5 * 255); }
  x.putImageData(img, 0, 0); return c; })();
const mott2 = (() => { const w = 160, h = 90, [c, x] = mk(w, h), img = x.createImageData(w, h), R = rng(8);
  for (let k = 0; k < w * h; k++) { const v = R(); img.data[4 * k] = 8; img.data[4 * k + 1] = 16; img.data[4 * k + 2] = 12; img.data[4 * k + 3] = Math.round(clamp((v - 0.3) / 0.6) * 0.3 * 255); }
  x.putImageData(img, 0, 0); return c; })();
let mottPat = null;

// ---------- 相机：世界 → 屏幕
export const cam = { x: 0, y: 0, s: 1, r: 0 };
export function applyCam(c) { c.setTransform(1, 0, 0, 1, 0, 0); c.translate(W / 2, H / 2); c.rotate(cam.r); c.scale(cam.s, cam.s); c.translate(-cam.x, -cam.y); }

// ---------- 动态层
const [dFill, dfx] = mk(), [dLine, dlx] = mk();
export function dynBegin() { for (const c of [dfx, dlx]) { c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, W, H); applyCam(c); } return { fill: dfx, line: dlx }; }
function dynEnd(boil, rect = null) {
  const k = boil & 3, [x, y, w, h] = rect || [0, 0, W, H];
  if (w <= 0 || h <= 0) return;
  for (const [c, mm] of [[dfx, MASKS.side[k]], [dlx, MASKS.line[k]]]) {
    c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'destination-in'; c.beginPath(); c.rect(x, y, w, h); c.clip();
    c.drawImage(mm, x, y, w, h, x, y, w, h); c.restore();
  }
  fx.save(); fx.setTransform(1, 0, 0, 1, 0, 0); fx.globalAlpha = 1; fx.drawImage(dFill, x, y, w, h, x, y, w, h); fx.globalAlpha = 1; fx.drawImage(dLine, x, y, w, h, x, y, w, h); fx.restore();
  for (const c of [dfx, dlx]) { c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(x, y, w, h); c.restore(); }
}

// ---------- 一帧
// scene(t, api) 负责：设相机、画静态（api.board 上下文已变换）、画动态（api.dyn()）
export function renderFrame(t, scene) {
  const boil = Math.floor(t * 15);
  fx.setTransform(1, 0, 0, 1, 0, 0); fx.fillStyle = '#0f1c15'; fx.fillRect(0, 0, W, H);
  const api = { t, boil, board: fx, cam, applyCam, dyn: dynBegin, flushDyn: () => dynEnd(boil) };
  scene(t, api);
  // 斑驳（世界坐标平铺，压在笔迹下面不合适，所以放在最前面画；这里补一层极淡的整体斑驳在最上面）
  post.draw(frame, new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]), t, 0.42);
}
// 黑板底：世界坐标里一块很大的板（BOARD），低频斑驳放大铺满（平滑），不平铺
export const BOARD = [-6000, -3000, 12000, 6000];
export function drawSlate(c) {
  c.save(); applyCam(c); c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
  c.drawImage(mott, BOARD[0], BOARD[1], BOARD[2], BOARD[3]); c.drawImage(mott2, BOARD[0], BOARD[1], BOARD[2], BOARD[3]); c.restore();
}
// 画角色：后层（遮罩）→ 头像 → 前层（遮罩）
export function characterLayers(api, rectWorld = null) {
  const L = api.dyn();
  let rect = null;
  if (rectWorld) {   // 角色的世界包围盒 → 屏幕矩形
    const [x0, y0, x1, y1] = rectWorld, p = (x, y) => [W / 2 + (x - cam.x) * cam.s, H / 2 + (y - cam.y) * cam.s];
    const a = p(x0, y0), b = p(x1, y1); rect = [Math.max(0, Math.floor(Math.min(a[0], b[0]))), Math.max(0, Math.floor(Math.min(a[1], b[1])))];
    rect.push(Math.min(W, Math.ceil(Math.max(a[0], b[0]))) - rect[0], Math.min(H, Math.ceil(Math.max(a[1], b[1]))) - rect[1]);
  }
  const G = { back: L, front: L, flush() { dynEnd(api.boil, rect); }, done() {} };
  Object.defineProperty(G, 'raster', { get() { applyCam(api.board); return api.board; } });
  return G;
}
