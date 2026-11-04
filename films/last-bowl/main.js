// 最后一碗面 —— 页面入口（lemo 页面约定：window.render(t) / DUR / READY）
// ?frame=<名字> 指定画面（见 frames.js 的 FRAMES），?t=<秒>，?raw=1 跳过 CRT，?test=hands|props|plates 看单个模块的测试页
import { canvas, W, H } from './lib/cel.js';
import { makePost } from './lib/post.js';
import * as FR from './frames.js';

const qs = new URLSearchParams(location.search);
const [sc, g] = canvas(W, H), [gc, e] = canvas(W, H), [ovc, ov] = canvas(W, H);
const post = makePost(document.getElementById('gl'));
const A = await FR.load();   // 背景板等资源：加载时画一次
const RAW = { bloom: 0, halo: 0, soft: 0, flick: 0, lift: 0, contrast: 0, fade: 0, sat: 1, tint: [1, 1, 1], scan: 0, grille: 0, bleed: 1, rshift: 0, glow: 0, corner: 0, noiseA: 0, power: 1, track: 0, expo: 1 };

function render(t) {
  for (const x of [g, e, ov]) { x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over'; x.filter = 'none'; }
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H); e.fillStyle = '#000'; e.fillRect(0, 0, W, H); ov.clearRect(0, 0, W, H);
  const over = FR.draw({ t, g, e, ov, A, frame: qs.get('frame'), test: qs.get('test') }) || {};
  post.render(sc, gc, Math.round(t * 24), ovc, qs.get('raw') ? RAW : { ...FR.POST, ...over });
}
window.DUR = 45.0; window.render = render; window.POST = post;
render(parseFloat(qs.get('t') ?? '13.8'));
window.READY = true;
