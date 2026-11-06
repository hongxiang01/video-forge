// 《违背的青春》风格帧 v2：车棚。背景 = 豆包定稿图拆的三层纸（sky/town/shed），地面和粉笔格子代码画，
// 两只狐狸 = 定稿设计稿切出来的纸偶零件（puppets/rig_out.json），关节层级 + 逐帧确定的动作。
// window.renderAt(秒) 逐帧确定渲染；不用 Math.random / Date。
import * as THREE from 'three';

const W = 1920, H = 1080;
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(W, H); renderer.setPixelRatio(1);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.NoToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const FOV = 30, CAM = new THREE.Vector3(0, 1.5, 6.6);
const camera = new THREE.PerspectiveCamera(FOV, W / H, 0.1, 200);
// 移轴：取景框整体下移 SHIFT（不低头，纸层对位不变），给地面和人物多留空间
const SHIFT = 0.11; camera.setViewOffset(W, H, 0, Math.round(SHIFT * H), W, H);
const TAN = Math.tan(THREE.MathUtils.degToRad(FOV / 2));

// ---------- 确定性随机 ----------
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

const loader = new THREE.TextureLoader();
const loadTex = (url) => new Promise((ok) => loader.load(url, (t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; ok(t); }));

// ---------- 背景三层：按参考图的屏幕位置放到不同深度 ----------
// 参考图 2048x1152，每层左右各补 60px；参考图 y=955（地台下沿）要落在地面 y=0 上 → 车棚层距相机 11.02
const IMG_W = 2048, IMG_H = 1152, PAD = 60, VOFF = 67;
async function backdrop(name, d) {
  const tex = await loadTex(`layers/${name}.png`);
  const Hd = 2 * d * TAN, Wd = Hd * W / H;
  const geo = new THREE.PlaneGeometry(Wd * (IMG_W + 2 * PAD) / IMG_W, Hd);
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: name !== 'sky', alphaTest: 0.02, toneMapped: false, depthWrite: name === 'sky' });
  const m = new THREE.Mesh(geo, mat);
  m.position.set(0, CAM.y - ((IMG_H / 2 - VOFF) / IMG_H - 0.5) * Hd, CAM.z - d);
  m.renderOrder = -d; scene.add(m); return m;
}
const D_SHED = (CAM.y / (((955 - VOFF) / IMG_H) - 0.5)) / (2 * TAN);   // = 11.02
const Z_SHED = CAM.z - D_SHED;

// ---------- 地面：纸面纹理 + 车棚灯光在地上的暖斑 ----------
function groundTex() {
  const c = document.createElement('canvas'); c.width = 2048; c.height = 2048; const g = c.getContext('2d');
  // v=0 是车棚边（远），v=1 是镜头前（近）
  const grd = g.createLinearGradient(0, 0, 0, 2048);
  grd.addColorStop(0, '#a89482'); grd.addColorStop(0.12, '#9a8473'); grd.addColorStop(0.5, '#8a7262'); grd.addColorStop(1, '#6f5a4d');
  g.fillStyle = grd; g.fillRect(0, 0, 2048, 2048);
  const warm = g.createRadialGradient(1024, 0, 50, 1024, 0, 900);
  warm.addColorStop(0, 'rgba(255,196,110,0.42)'); warm.addColorStop(1, 'rgba(255,196,110,0)');
  g.fillStyle = warm; g.fillRect(0, 0, 2048, 2048);
  const r = rng(7);
  for (let i = 0; i < 26000; i++) {   // 纸纤维
    const x = r() * 2048, y = r() * 2048, l = 2 + r() * 9, a = r() * Math.PI;
    g.strokeStyle = r() < 0.5 ? 'rgba(255,240,220,0.10)' : 'rgba(40,25,15,0.10)'; g.lineWidth = 0.6 + r();
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
  }
  // 几张拼接的大纸片边缘（剪纸地面）
  for (const y of [300, 760, 1350]) {
    g.strokeStyle = 'rgba(50,30,20,0.25)'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, y);
    for (let x = 0; x <= 2048; x += 24) g.lineTo(x, y + (r() - 0.5) * 6 + Math.sin(x / 260) * 10); g.stroke();
    g.strokeStyle = 'rgba(255,235,210,0.25)'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, y + 3);
    for (let x = 0; x <= 2048; x += 24) g.lineTo(x, y + 3 + Math.sin(x / 260) * 10); g.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
const GZ0 = Z_SHED, GZ1 = 9;
const ground = new THREE.Mesh(new THREE.PlaneGeometry(26, GZ1 - GZ0), new THREE.MeshLambertMaterial({ map: groundTex() }));
ground.rotation.x = -Math.PI / 2; ground.position.set(0, 0, (GZ0 + GZ1) / 2); ground.receiveShadow = true; scene.add(ground);

// ---------- 粉笔跳房子：1 2 3 单格，4/5 双格，6 单格，7/8 双格（沿 x，往左跳） ----------
const CELL = 0.5, HOP_Z = 0.9, X1 = 0.55;   // 1 号格中心 x
const CELLS = [  // [格号, x 序号, z 偏移]
  [1, 0, 0], [2, 1, 0], [3, 2, 0], [4, 3, -0.5], [5, 3, 0.5], [6, 4, 0], [7, 5, -0.5], [8, 5, 0.5]];
function chalkTex() {
  const S = 400; const c = document.createElement('canvas'); c.width = S * 7; c.height = S * 2.2; const g = c.getContext('2d');
  const r = rng(11);
  const line = (x0, y0, x1, y1) => {   // 粉笔线：几道抖动的半透明白线叠起来
    for (let k = 0; k < 4; k++) {
      g.strokeStyle = `rgba(250,246,236,${0.22 + r() * 0.18})`; g.lineWidth = 34 + r() * 16; g.lineCap = 'round';
      g.beginPath(); g.moveTo(x0 + (r() - 0.5) * 6, y0 + (r() - 0.5) * 6);
      const n = 8; for (let i = 1; i <= n; i++) g.lineTo(x0 + (x1 - x0) * i / n + (r() - 0.5) * 5, y0 + (y1 - y0) * i / n + (r() - 0.5) * 5);
      g.stroke();
    }
  };
  const cx = (i) => (6.5 - i) * S - S / 2;   // 1 号格在最右，往左排
  const cy = S * 1.1;
  for (const [num, i, dz] of CELLS) {
    const x = cx(i), y = cy + dz * S, h = dz === 0 ? S : S;
    const x0 = x - S / 2, x1 = x + S / 2, y0 = y - h / 2, y1 = y + h / 2;
    line(x0, y0, x1, y0); line(x1, y0, x1, y1); line(x1, y1, x0, y1); line(x0, y1, x0, y0);
    g.save(); g.translate(x, y); g.rotate((r() - 0.5) * 0.25);
    g.font = `${S * 0.5}px "Hiragino Sans GB", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let k = 0; k < 5; k++) {   // 粉笔字：几遍抖动描边
      g.fillStyle = `rgba(250,246,236,${0.22 + r() * 0.15})`;
      g.fillText(String(num), (r() - 0.5) * 8, 8 + (r() - 0.5) * 8);
    }
    g.restore();
  }
  // 粉笔粉末颗粒
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(0,0,0,${r() * 0.6})`; g.fillRect(r() * c.width, r() * c.height, 2, 2); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
{
  const wU = CELL * 7, hU = CELL * 2.2;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(wU, hU), new THREE.MeshLambertMaterial({ map: chalkTex(), transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  // 贴图里 1 号格中心在 u=(6.5-0-0.5)/7
  m.position.set(X1 - ((6.0 / 7) - 0.5) * wU, 0.003, HOP_Z); m.receiveShadow = true; scene.add(m);
}
const cellX = (i) => X1 - i * CELL;

// ---------- 灯光 ----------
scene.add(new THREE.AmbientLight(0xfff1e2, 1.55));
const sun = new THREE.DirectionalLight(0xffd7a8, 1.1);
sun.position.set(-2.2, 9, 3.5); sun.target.position.set(0, 0, 0.5);
sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -5, right: 5, top: 4, bottom: -2, near: 1, far: 25 });
sun.shadow.bias = -0.0004; sun.shadow.radius = 6;
scene.add(sun, sun.target);

