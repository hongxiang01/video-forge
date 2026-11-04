// 逐帧渲染：虚拟时钟 + 程序化机位，输出 1920x1080 30fps 帧序列
// 用法：node render.js stills   （每个镜头中点出一张图）
//       node render.js frames   （全部帧）
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const MODE = process.argv[2] || 'stills';
const FPS = 30, W = 1920, H = 1080;
const OUT = path.join(__dirname, MODE === 'stills' ? 'stills' : 'frames');
fs.mkdirSync(OUT, { recursive: true });

// 连续机位：像人用鼠标拖着转、滚轮缩放。关键帧之间平滑缓动，不硬切
// t=秒，tg=看向的点，az/el=方位/仰角（度），d<1.5 为全景距离倍数，否则为米
const KEYS = [
  [0,    'open',     [0.2, 1.0, 0.0],    -35, 30, 1.08],
  [4.5,  'drag',     [0.2, 1.0, 0.0],     18, 20, 0.92],
  [7.5,  'girl',     [-1.15, 1.3, 0.62],  22,  8, 4.8],
  [10.5, 'girl2',    [-1.15, 1.35, 0.62], 52, 12, 4.2],
  [12.8, 'mid1',     [1.5, 1.2, -1.2],    72, 20, 13],
  [15.0, 'vending',  [2.9, 1.1, -2.1],    92, 10, 5.2],
  [17.2, 'vending2', [2.9, 1.1, -2.1],    72, 12, 4.6],
  [19.4, 'mid2',     [4.2, 1.0, -4.2],   100, 32, 9],
  [21.8, 'cat',      [4.85, 0.35, -5.25],120, 36, 2.3],
  [24.6, 'cat2',     [4.85, 1.0, -5.25], 100, 26, 4.8],
  [27.4, 'crossing', [8.0, 1.0, -4.2],    72, 12, 15],
  [30.0, 'crossing2',[8.0, 1.0, -4.0],    58, 14, 13],
  [33.0, 'lamp',     [5.2, 2.2, 4.8],     55,  4, 9],
  [35.8, 'lamp2',    [5.2, 2.5, 4.8],     28,  6, 8],
  [39.0, 'pullout',  [0.2, 1.0, 0.0],     45, 16, 0.95],
  [45.0, 'end',      [0.2, 1.0, 0.0],    -70, 30, 1.1],
];
const CAPTIONS = [];

const ease = (x) => x * x * (3 - 2 * x);
const lerp = (a, b, k) => a + (b - a) * k;
const FIT = 37.5; // 横屏全景距离（fitDistance 在 16:9 下的值）
const dist = (d) => (d < 1.5 ? d * FIT : d);
function camAt(time) {
  let i = 0;
  while (i < KEYS.length - 2 && time >= KEYS[i + 1][0]) i++;
  const A = KEYS[i], B = KEYS[i + 1];
  const k = ease(Math.min(1, Math.max(0, (time - A[0]) / (B[0] - A[0]))));
  // 距离在对数空间插值，缩放手感更像滚轮
  const d = Math.exp(lerp(Math.log(dist(A[5])), Math.log(dist(B[5])), k));
  return { t: A[2].map((v, j) => lerp(v, B[2][j], k)), az: lerp(A[3], B[3], k), el: lerp(A[4], B[4], k), d };
}
const TOTAL = KEYS[KEYS.length - 1][0];

// 页面注入：虚拟时钟，接管 performance.now / rAF
const INIT = `
(() => {
  let vt = 0; const cbs = [];
  performance.now = () => vt;
  window.requestAnimationFrame = (cb) => { cbs.push(cb); return cbs.length; };
  window.__advance = (ms) => { vt += ms; const q = cbs.splice(0); for (const cb of q) cb(vt); };
})();`;

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--no-proxy-server'],
  });
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  page.on('console', (m) => { if (m.type() === 'error') console.log('[page]', m.text()); });
  await page.addInitScript(INIT);
  await page.goto('http://127.0.0.1:8765/index.html?shot', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__dio && document.querySelector('canvas'), null, { timeout: 30000 });
  await page.waitForTimeout(3500); // 等字体与场景构建
  await page.evaluate(({ caps }) => {
    const { controls } = window.__dio;
    controls.enabled = false; controls.enableDamping = false; controls.autoRotate = false;
    controls.minDistance = 0.5; controls.maxDistance = 500; controls.maxPolarAngle = Math.PI;
    // 叠字层
    const st = document.createElement('style');
    st.textContent = `#cap{position:fixed;left:0;right:0;top:15%;text-align:center;pointer-events:none;z-index:9;
      font-family:"PingFang SC","Hiragino Sans GB",sans-serif;color:#fff;transition:none}
      #cap b{display:block;font-size:84px;font-weight:800;letter-spacing:4px;text-shadow:0 4px 24px rgba(0,0,0,.65),0 0 2px rgba(0,0,0,.8)}
      #cap i{display:block;margin-top:18px;font-style:normal;font-size:44px;font-weight:500;letter-spacing:2px;color:#ffe9c4;text-shadow:0 3px 16px rgba(0,0,0,.7)}`;
    document.head.appendChild(st);
    const d = document.createElement('div'); d.id = 'cap'; document.body.appendChild(d);
    window.__caps = caps;
    window.__setCam = (c, time) => {
      const { camera, controls } = window.__dio;
      const az = c.az * Math.PI / 180, el = c.el * Math.PI / 180;
      const fit = (() => { const t = Math.tan(16 * Math.PI / 180), a = innerWidth / innerHeight; return Math.max(21.5 / (2 * t), (a < 1 ? 26 : 29.5) / (2 * t * a)); })();
      const dist = c.d;
      controls.target.set(c.t[0], c.t[1], c.t[2]);
      camera.position.set(c.t[0] + dist * Math.cos(el) * Math.sin(az), c.t[1] + dist * Math.sin(el), c.t[2] + dist * Math.cos(el) * Math.cos(az));
      camera.lookAt(controls.target);
      // 叠字：淡入淡出 0.35s
      let html = '', op = 0;
      for (const [s, e, m, sub] of window.__caps) if (time >= s && time < e) {
        html = `<b>${m}</b>` + (sub ? `<i>${sub}</i>` : '');
        op = Math.min(1, (time - s) / 0.35, (e - time) / 0.35);
      }
      const el2 = document.getElementById('cap'); el2.innerHTML = html; el2.style.opacity = op;
    };
  }, { caps: CAPTIONS });

  // 预热：先跑 2 秒让雨下满
  for (let i = 0; i < 60; i++) await page.evaluate((c) => { window.__setCam(c, 0); window.__advance(1000 / 30); }, camAt(0));

  let times;
  if (MODE === 'stills') {
    times = KEYS.map((k) => [k[1], Math.min(k[0], TOTAL - 0.05)]);
  } else {
    times = Array.from({ length: Math.round(TOTAL * FPS) }, (_, i) => [String(i).padStart(5, '0'), i / FPS]);
  }
  let last = -1 / FPS;
  const t1 = Date.now();
  for (const [name, time] of times) {
    // stills 模式里跳跃时间也按小步推进，保证雨的状态连续
    let gap = time - last;
    while (gap > 1.5 / FPS) { await page.evaluate((c) => { window.__setCam(c.c, c.t); window.__advance(1000 / 30); }, { c: camAt(time), t: time }); gap -= 1 / FPS; }
    await page.evaluate((c) => { window.__setCam(c.c, c.t); window.__advance(Math.max(1, c.g * 1000)); }, { c: camAt(time), t: time, g: gap });
    last = time;
    await page.screenshot({ path: path.join(OUT, name + '.jpg'), type: 'jpeg', quality: 93 });
    if (MODE === 'frames' && +name % 60 === 0) console.log(`frame ${name} / ${times.length}  ${((Date.now() - t1) / 1000).toFixed(0)}s`);
  }
  console.log('total', TOTAL, 's; done in', ((Date.now() - t1) / 1000).toFixed(0), 's');
  await browser.close();
})();
