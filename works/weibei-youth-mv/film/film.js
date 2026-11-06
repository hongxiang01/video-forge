// 《违背的青春》MV 主文件：场景、道具、镜头表。window.renderAt(秒)。
import { THREE, renderer, scene, camera, CAM, TAN, SHIFT, W, H, rng, clamp, ss, lerp, ramp, loadTex, canvasTex, amb, sun,
  makeScene, makePuppet, resetPose, setFace, blinkAt, ik, foot, stand, gait, secondary, brows, makeBlobs, footBlobs, ankleRestX } from './engine.js';
const SONG = await (await fetch('song.json')).json();
const BEATS = SONG.beats;
scene.add(camera);

// ---------- 纸面地面与粉笔格子 ----------
function groundTex(c0 = '#a89482', c1 = '#9a8473', c2 = '#8a7262', c3 = '#6f5a4d', warm = 0.42) {
  return canvasTex(2048, 2048, (g) => {
    const grd = g.createLinearGradient(0, 0, 0, 2048);
    grd.addColorStop(0, c0); grd.addColorStop(0.12, c1); grd.addColorStop(0.5, c2); grd.addColorStop(1, c3);
    g.fillStyle = grd; g.fillRect(0, 0, 2048, 2048);
    const wm = g.createRadialGradient(1024, 0, 50, 1024, 0, 900); wm.addColorStop(0, `rgba(255,196,110,${warm})`); wm.addColorStop(1, 'rgba(255,196,110,0)');
    g.fillStyle = wm; g.fillRect(0, 0, 2048, 2048);
    const r = rng(7);
    for (let i = 0; i < 26000; i++) { const x = r() * 2048, y = r() * 2048, l = 2 + r() * 9, a = r() * Math.PI; g.strokeStyle = r() < 0.5 ? 'rgba(255,240,220,0.10)' : 'rgba(40,25,15,0.10)'; g.lineWidth = 0.6 + r(); g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
    for (const y of [300, 760, 1350]) {
      g.strokeStyle = 'rgba(50,30,20,0.25)'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= 2048; x += 24) g.lineTo(x, y + (r() - 0.5) * 6 + Math.sin(x / 260) * 10); g.stroke();
      g.strokeStyle = 'rgba(255,235,210,0.25)'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, y + 3); for (let x = 0; x <= 2048; x += 24) g.lineTo(x, y + 3 + Math.sin(x / 260) * 10); g.stroke();
    }
  });
}
const CELL = 0.5, HOP_Z = 0.9, X1 = 0.55;
const CELLS = [[1, 0, 0], [2, 1, 0], [3, 2, 0], [4, 3, -0.5], [5, 3, 0.5], [6, 4, 0], [7, 5, -0.5], [8, 5, 0.5]];
const cellX = (i) => X1 - i * CELL;
function chalkMesh() {
  const S = 400;
  const tex = canvasTex(S * 7, S * 2.2, (g, c) => {
    const r = rng(11);
    const line = (x0, y0, x1, y1) => { for (let k = 0; k < 4; k++) { g.strokeStyle = `rgba(250,246,236,${0.22 + r() * 0.18})`; g.lineWidth = 34 + r() * 16; g.lineCap = 'round'; g.beginPath(); g.moveTo(x0 + (r() - 0.5) * 6, y0 + (r() - 0.5) * 6); for (let i = 1; i <= 8; i++) g.lineTo(x0 + (x1 - x0) * i / 8 + (r() - 0.5) * 5, y0 + (y1 - y0) * i / 8 + (r() - 0.5) * 5); g.stroke(); } };
    const cx = (i) => (6.5 - i) * S - S / 2, cy = S * 1.1;
    for (const [num, i, dz] of CELLS) {
      const x = cx(i), y = cy + dz * S, x0 = x - S / 2, x1 = x + S / 2, y0 = y - S / 2, y1 = y + S / 2;
      line(x0, y0, x1, y0); line(x1, y0, x1, y1); line(x1, y1, x0, y1); line(x0, y1, x0, y0);
      g.save(); g.translate(x, y); g.rotate((r() - 0.5) * 0.25); g.font = `${S * 0.5}px "Hiragino Sans GB", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      for (let k = 0; k < 5; k++) { g.fillStyle = `rgba(250,246,236,${0.22 + r() * 0.15})`; g.fillText(String(num), (r() - 0.5) * 8, 8 + (r() - 0.5) * 8); }
      g.restore();
    }
    g.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(0,0,0,${r() * 0.6})`; g.fillRect(r() * c.width, r() * c.height, 2, 2); }
  });
  const wU = CELL * 7, hU = CELL * 2.2;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(wU, hU), new THREE.MeshLambertMaterial({ map: tex, transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.set(X1 - ((6.0 / 7) - 0.5) * wU, 0.003, HOP_Z); m.receiveShadow = true; return m;
}

// ---------- 场景 ----------
const SC = {};
SC.shed = await makeScene({ name: 'shed', floorY: 955, ground: 'paper', groundTex: groundTex(),
  layers: [{ file: 'layers/sky.png', d: 3.63, opaque: true }, { file: 'layers/town.png', d: 1.452 }, { file: 'layers/shed.png', d: 1 }],
  build: async (S) => { S.chalk = chalkMesh(); S.group.add(S.chalk); } });
async function layeredScene(name, opts = {}) {
  let meta; try { meta = await (await fetch(`layers/${name}/meta.json`)).json(); } catch (e) { return null; }
  const n = meta.layers.length, ds = opts.ds || meta.layers.map((L, i) => n === 1 ? 1 : lerp(3.6, 1, i / (n - 1)));
  if (opts.ds && opts.ds.length !== n) opts.ds = null;
  return makeScene({ name, floorY: meta.floor_y, ground: opts.ground || 'shadow', groundTex: opts.groundTex,
    layers: meta.layers.map((L, i) => ({ file: `layers/${name}/${(opts.files || {})[i] || L.file}`, d: ds[i], opaque: i === 0 })), build: opts.build });
}
const SOPTS = {
  classroom: { ds: [3.6, 2.4, 1.35, 1.0] },
  wall: { ds: [3.6, 1.8, 1.0, 0.97] },
  night_street: { ds: [3.6, 2.0, 1.0, 0.97] },
  bus_station: { ds: [3.6, 2.2, 1.0, 0.98], files: { 3: 'L3_nobus.png' } },
  arcade: { ds: [1.3, 1.0, 1.12, 0.62] },
};
for (const n of ['classroom', 'wall', 'arcade', 'night_street', 'bus_station']) SC[n] = await layeredScene(n, SOPTS[n] || {});
const nightSkyTex = canvasTex(2168, 1152, (g) => {
  const grd = g.createLinearGradient(0, 0, 0, 1152); grd.addColorStop(0, '#0d1430'); grd.addColorStop(0.55, '#1f2a55'); grd.addColorStop(1, '#3a3f6e');
  g.fillStyle = grd; g.fillRect(0, 0, 2168, 1152); const r = rng(77);
  for (let i = 0; i < 260; i++) { const x = r() * 2168, y = r() * 700, s = r() < 0.1 ? 3 : 1.4; g.fillStyle = `rgba(255,246,220,${0.4 + r() * 0.6})`; g.beginPath(); g.arc(x, y, s, 0, 7); g.fill(); }
  g.fillStyle = '#f3ead2'; g.beginPath(); g.arc(1700, 190, 46, 0, 7); g.fill(); g.fillStyle = '#1a2348'; g.beginPath(); g.arc(1722, 176, 42, 0, 7); g.fill();   // 纸月牙
  for (const [y, a] of [[420, 0.25], [560, 0.18]]) { g.fillStyle = `rgba(90,100,150,${a})`; g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= 2168; x += 40) g.lineTo(x, y + Math.sin(x / 170) * 30 + (r() - 0.5) * 10); g.lineTo(2168, 1152); g.lineTo(0, 1152); g.fill(); }
});
function nightScene(S, night, glow = 1, dims = null) {
  S.layers.forEach((m, i) => { m.userData.u.uNight.value = night; m.userData.u.uGlow.value = glow; m.userData.u.uDim.value = dims ? dims[i] : 1; });
  const sky = S.layers[0]; if (!sky.userData.dayMap) sky.userData.dayMap = sky.material.map;
  const want = night > 0.5 && S.name === 'shed' ? nightSkyTex : sky.userData.dayMap;
  if (sky.material.map !== want) { sky.material.map = want; sky.material.needsUpdate = true; }
  if (S.name === 'shed' && night > 0.5) sky.userData.u.uNight.value = 0;
  const gc = 1 - 0.62 * night; if (S.ground.material.color) S.ground.material.color.setRGB(gc * 0.8, gc * 0.85, gc * 1.05);
  if (S.chalk) S.chalk.material.color.setRGB(1 - 0.4 * night, 1 - 0.38 * night, 1 - 0.3 * night);
}
function tintScene(S, rgb) { for (const m of S.layers) m.material.color.setRGB(rgb[0], rgb[1], rgb[2]); if (S.ground.material.color) S.ground.material.color.setRGB(Math.min(1, rgb[0] * 1.1), Math.min(1, rgb[1] * 1.1), Math.min(1, rgb[2] * 1.1)); if (S.chalk) S.chalk.material.color.setRGB(Math.min(1, rgb[0] + 0.2), Math.min(1, rgb[1] + 0.2), Math.min(1, rgb[2] + 0.2)); }

// ---------- 人物与道具 ----------
const RIG = await (await fetch('rig2_out.json')).json();
const kid = await makePuppet(RIG.kid), adult = await makePuppet(RIG.adult);
const kidBlobs = makeBlobs(2), adultBlobs = makeBlobs(2);
// 自行车（少年尺寸：鞍座到最低脚蹬 = 少年腿长）
const BIKE = await (await fetch('../props/bike.json')).json();
const bike = new THREE.Group(); scene.add(bike);
{
  const k = 0.34 / 165, [bx0, by0, bx1, by1] = BIKE.box, cx = BIKE.crank[0], cy = BIKE.crank[1];
  const toB = (x, y) => [(x - cx) * k, (cy - y) * k + (BIKE.r + 4) * k + (BIKE.front[1] - cy) * k];   // 原点：曲柄正下方地面
  bike.userData.k = k; bike.userData.toB = toB;
  const sprite = async (file, w, h, x, y, z) => { const t = await loadTex(file); const m = new THREE.Mesh(new THREE.PlaneGeometry(w * k, h * k), new THREE.MeshLambertMaterial({ map: t, alphaTest: 0.4, side: THREE.DoubleSide })); m.castShadow = true; m.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: t, alphaTest: 0.4 }); const [ux, uy] = toB(x, y); m.position.set(ux, uy, z); bike.add(m); return m; };
  bike.userData.frame = await sprite('../props/bike_frame.png', bx1 - bx0, by1 - by0, (bx0 + bx1) / 2, (by0 + by1) / 2, 0);
  bike.userData.fw = await sprite('../props/bike_wheel.png', 2 * BIKE.r + 8, 2 * BIKE.r + 8, BIKE.front[0], BIKE.front[1], -0.004);
  bike.userData.rw = await sprite('../props/bike_wheel.png', 2 * BIKE.r + 8, 2 * BIKE.r + 8, BIKE.rear[0], BIKE.rear[1], -0.004);
  bike.userData.cr = await sprite('../props/bike_chainring.png', 110, 110, cx, cy, 0.004);
  const [sx, sy] = toB(...BIKE.saddle), [hx, hy] = toB(...BIKE.bar), [ccx, ccy] = toB(cx, cy);
  Object.assign(bike.userData, { saddle: [sx, sy], bar: [hx, hy], crank: [ccx, ccy], crankLen: BIKE.crank_len * k, wheelR: BIKE.r * k });
}
// 硬币、纸船、作文本
const coinTex = canvasTex(128, 128, (g) => { const r = g.createRadialGradient(56, 52, 4, 64, 64, 60); r.addColorStop(0, '#fff2b8'); r.addColorStop(0.6, '#e2b448'); r.addColorStop(1, '#a87a22'); g.fillStyle = r; g.beginPath(); g.arc(64, 64, 58, 0, 7); g.fill(); g.strokeStyle = 'rgba(120,80,20,0.7)'; g.lineWidth = 5; g.beginPath(); g.arc(64, 64, 44, 0, 7); g.stroke(); });
const coin = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.07), new THREE.MeshBasicMaterial({ map: coinTex, transparent: true, toneMapped: false })); scene.add(coin);
const coinGlow = new THREE.PointLight(0xffc870, 0, 2.5, 1.6); scene.add(coinGlow);
const glowSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: canvasTex(128, 128, (g) => { const r = g.createRadialGradient(64, 64, 0, 64, 64, 64); r.addColorStop(0, 'rgba(255,220,140,0.9)'); r.addColorStop(1, 'rgba(255,200,120,0)'); g.fillStyle = r; g.fillRect(0, 0, 128, 128); }), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); scene.add(glowSprite);

const busMesh = await (async () => { const S = SC.bus_station; if (!S) return null; const t = await loadTex('layers/bus_station/bus.png');
  const box = (await (await fetch('layers/bus_station/bus_box.txt')).text()).trim().split(/\s+/).map(Number);
  const d = 0.99 * S.Df, p0 = S.imgToWorld(box[0], box[1], d), p1 = S.imgToWorld(box[2], box[3], d);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(p1.x - p0.x, p0.y - p1.y), new THREE.MeshBasicMaterial({ map: t, transparent: true, alphaTest: 0.05, toneMapped: false }));
  m.position.set((p0.x + p1.x) / 2, (p0.y + p1.y) / 2, p0.z); m.userData.base = m.position.clone(); S.group.add(m); return m; })();
const desk = await (async () => { const tx = await loadTex('../props/desk.png'); const h = 0.62, w = h * 377 / 235;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshLambertMaterial({ map: tx, alphaTest: 0.3, side: THREE.DoubleSide })); m.receiveShadow = true;
  m.userData.h = h; m.userData.top = h * (1 - (882 - 812) / 235) ; scene.add(m); return m; })();
const screenGlow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, color: 0xffffff,
  map: canvasTex(256, 192, (g) => { const r = rng(9); for (let i = 0; i < 70; i++) { g.fillStyle = `hsla(${r() * 360},90%,60%,${0.4 + r() * 0.5})`; g.fillRect(Math.floor(r() * 16) * 16, Math.floor(r() * 12) * 16, 16, 16); } }) }));
scene.add(screenGlow);
const puddle = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.5), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, toneMapped: false, map: canvasTex(512, 256, (g) => {
  g.fillStyle = 'rgba(20,30,60,0.85)'; g.beginPath(); g.ellipse(256, 128, 240, 110, 0, 0, 7); g.fill();
  g.strokeStyle = 'rgba(255,214,140,0.55)'; g.lineWidth = 10; for (const y of [96, 120, 150]) { g.beginPath(); g.moveTo(170 + (y % 3) * 10, y); g.lineTo(330 - (y % 5) * 6, y); g.stroke(); }
  g.strokeStyle = 'rgba(240,236,220,0.5)'; g.lineWidth = 4; g.beginPath(); g.ellipse(256, 128, 240, 110, 0, 0, 7); g.stroke(); }) }));
puddle.rotation.x = -Math.PI / 2; puddle.renderOrder = 1; scene.add(puddle);
const boat = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.11), new THREE.MeshLambertMaterial({ side: THREE.DoubleSide, alphaTest: 0.4, map: canvasTex(256, 160, (g) => {
  g.fillStyle = '#f4efe2'; g.beginPath(); g.moveTo(10, 90); g.lineTo(246, 90); g.lineTo(200, 150); g.lineTo(56, 150); g.fill();
  g.beginPath(); g.moveTo(70, 90); g.lineTo(128, 6); g.lineTo(186, 90); g.fill();
  g.strokeStyle = 'rgba(120,110,90,0.6)'; g.lineWidth = 3; g.beginPath(); g.moveTo(128, 6); g.lineTo(128, 90); g.moveTo(10, 90); g.lineTo(246, 90); g.stroke(); }) }));
boat.castShadow = true; scene.add(boat);

// ---------- 撕纸边框（只在片头片尾） ----------
const tornTex = (side) => canvasTex(1024, 256, (g) => {
  const r = rng(31 + side); g.fillStyle = '#efe4cf'; g.beginPath(); g.moveTo(0, 0); g.lineTo(1024, 0);
  let y = 150; for (let x = 1024; x >= 0; x -= 8) { y = clamp(y + (r() - 0.5) * 22, 110, 200); g.lineTo(x, y); } g.closePath(); g.fill();
  for (let i = 0; i < 3000; i++) { g.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.15)' : 'rgba(80,60,40,0.08)'; g.fillRect(r() * 1024, r() * 200, 2, 2); }
});
const frameGroup = new THREE.Group(); camera.add(frameGroup);
const FD = 0.5, FH = 2 * FD * TAN, FW = FH * W / H, FCY = -SHIFT * FH;
const strips = [0, 1, 2, 3].map((i) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(i % 2 ? FH * 1.6 : FW * 1.4, (i % 2 ? FW : FH) * 0.5), new THREE.MeshBasicMaterial({ map: tornTex(i), transparent: true, toneMapped: false, depthTest: false })); m.renderOrder = 999; frameGroup.add(m); return m; });
function tornFrame(open) {   // open: 0 全盖住，1 完全打开（四条撕纸边往外退）
  frameGroup.visible = open < 0.999;
  const o = ss(open), hT = FH * 0.8, hS = FW * 0.8;
  const set = (m, w, h, rz, x, y) => { m.geometry.dispose(); m.geometry = new THREE.PlaneGeometry(w, h); m.rotation.z = rz; m.position.set(x, y, -FD); };
  set(strips[0], FW * 1.3, hT, 0, 0, FCY + 0.1 * hT + o * (FH / 2 + 0.03));
  set(strips[2], FW * 1.3, hT, Math.PI, 0, FCY - 0.1 * hT - o * (FH / 2 + 0.03));
  set(strips[1], FH * 1.3, hS, Math.PI / 2, -0.1 * hS - o * (FW / 2 + 0.03), FCY);
  set(strips[3], FH * 1.3, hS, -Math.PI / 2, 0.1 * hS + o * (FW / 2 + 0.03), FCY);
}

// ---------- 环境：浮尘、纸叶子、雨 ----------
const dotTex = canvasTex(64, 64, (g) => { const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, 'rgba(255,236,190,1)'); r.addColorStop(1, 'rgba(255,236,190,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); });
const DUST_N = 90, dr = rng(21), dustSeed = Array.from({ length: DUST_N }, () => [dr() * 7 - 3.5, dr() * 1.9 + 0.25, dr() * 2.4, dr() * 6.28, 0.6 + dr()]);
const dustGeo = new THREE.BufferGeometry(); dustGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(DUST_N * 3), 3));
const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ map: dotTex, size: 0.035, transparent: true, opacity: 0.75, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xffd9a0 })); scene.add(dust);
function poseDust(t, z0, on = 1) { dust.visible = on > 0; dust.material.opacity = 0.75 * on; const p = dustGeo.attributes.position; dustSeed.forEach(([x, y, z, ph, sp], i) => p.setXYZ(i, x + 0.08 * Math.sin(t * 0.5 * sp + ph), y + ((0.04 * t * sp + 0.05 * Math.sin(t * 0.7 + ph)) % 0.6), z0 + z)); p.needsUpdate = true; }
const leafTex = (col) => canvasTex(128, 80, (g) => { g.fillStyle = col; g.beginPath(); g.moveTo(6, 40); g.quadraticCurveTo(50, -4, 122, 40); g.quadraticCurveTo(50, 84, 6, 40); g.fill(); g.strokeStyle = 'rgba(90,40,10,0.55)'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(10, 40); g.lineTo(118, 40); g.stroke(); });
const LEAVES = ['#d98a2b', '#c9572a', '#e0b040', '#d07a30', '#e6a03a'].map((col, i) => { const tx = leafTex(col); const m = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.1), new THREE.MeshLambertMaterial({ map: tx, alphaTest: 0.4, side: THREE.DoubleSide })); m.castShadow = true; scene.add(m); return m; });
function poseLeaves(t, on, seeds) {
  LEAVES.forEach((m, i) => {
    m.visible = on; if (!on) return; const [x0, t0, z] = seeds[i % seeds.length];
    const u = ((t - t0) % 6 + 6) % 6, fall = 2.9 - u * 0.55;
    if (fall > 0.004) { m.position.set(x0 + u * 0.4 + 0.2 * Math.sin(u * 2.4 + i), fall, z + 0.1 * Math.sin(u * 1.7)); m.rotation.set(Math.sin(u * 3.1 + i) * 1.2, u * 1.5, Math.sin(u * 2.4) * 0.8); }
    else { m.position.set(x0 + 5.27 * 0.4 + 0.2 * Math.sin(5.27 * 2.4 + i), 0.004, z); m.rotation.set(-Math.PI / 2, 0, 0.6 + i); }
  });
}
const RAIN_N = 420, rr = rng(5), rainSeed = Array.from({ length: RAIN_N }, () => [rr() * 12 - 6, rr() * 4, rr() * 8 - 4, 0.8 + rr() * 0.4]);
const rainGeo = new THREE.BufferGeometry(); rainGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(RAIN_N * 6), 3));
const rain = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: 0xdfe8f5, transparent: true, opacity: 0.45 })); scene.add(rain);
function poseRain(t, on, zc) { rain.visible = on; if (!on) return; const p = rainGeo.attributes.position; rainSeed.forEach(([x, y, z, sp], i) => { const yy = 4 - ((y + t * 5.5 * sp) % 4); p.setXYZ(i * 2, x - 0.02, yy, zc + z); p.setXYZ(i * 2 + 1, x + 0.01, yy - 0.16, zc + z); }); p.needsUpdate = true; }

// ---------- 跳房子 ----------
function hopPlan(t, T0, HT, hops, startCell = 0, startTwo = false) {
  const nearPos = (x, two) => x - (two ? 0.065 : 0.025), farGround = (x) => x + 0.085, farRaised = (x, tt) => [x + 0.27, 0.15 + 0.02 * Math.sin(tt * 5)];
  const footN = (x, two) => [nearPos(x, two), 0], footF = (x, two, tt) => two ? [farGround(x), 0] : farRaised(x, tt);
  const T_END = T0 + hops.length * HT;
  if (t < T0) { const x = cellX(startCell), antic = ramp(t, T0 - 0.22, T0); return { x, c: antic * 0.9, h: 0, air: 0, antic, land: 0, fn: footN(x, startTwo), ff: footF(x, startTwo, t) }; }
  const n = Math.floor((t - T0) / HT);
  if (n >= hops.length) { const x = cellX(hops[hops.length - 1].i), u = t - T_END, two = hops[hops.length - 1].two; return { x, c: Math.max(0, Math.sin(Math.min(u / 0.25, 1) * Math.PI)) * 0.8, h: 0, air: 0, antic: 0, land: Math.max(0, 1 - u / 0.3), fn: footN(x, two), ff: footF(x, two, t), done: u }; }
  const u = ((t - T0) % HT) / HT, from = n === 0 ? startCell : hops[n - 1].i, to = hops[n].i, twoF = n === 0 ? startTwo : hops[n - 1].two, twoT = hops[n].two;
  const xf = cellX(from), xt = cellX(to);
  if (u < 0.24) { const antic = n === 0 ? 1 : ss(u / 0.24); return { x: xf, c: antic * 0.9, h: 0, air: 0, antic, land: 0, fn: footN(xf, twoF), ff: footF(xf, twoF, t) }; }
  if (u < 0.62) { const a = (u - 0.24) / 0.38, e = ss(a), tuck = Math.sin(a * Math.PI), n0 = footN(xf, twoF), n1 = footN(xt, twoT), f0 = footF(xf, twoF, t), f1 = footF(xt, twoT, t);
    return { x: xf + (xt - xf) * e, c: 0.15 * (1 - tuck), h: 4 * a * (1 - a) * 0.15, air: tuck, antic: 0, land: 0, fn: [lerp(n0[0], n1[0], e), lerp(n0[1], n1[1], e) + tuck * 0.2], ff: [lerp(f0[0], f1[0], e), lerp(f0[1], f1[1], e) + tuck * 0.12] }; }
  const b = (u - 0.62) / 0.38;
  return { x: xt, c: Math.sin(Math.min(b / 0.6, 1) * Math.PI * 0.5) * (1 - ss((b - 0.35) / 0.65)), h: 0, air: 0, antic: 0, land: 1 - b, fn: footN(xt, twoT), ff: footF(xt, twoT, t) };
}
function poseHop(P, t, plan, z) {
  const s = plan(t), sl = plan(t - 0.06), B = P.B, yOf = (tt) => { const q = plan(tt); return q.h - q.c * 0.075; };
  const vy = (yOf(t - 0.05) - yOf(t - 0.1)) / 0.05;
  P.root.position.set(s.x, 0, z); P.root.scale.x = 1;
  B.pelvis.position.y = P.pelvisH * 0.985 + s.h - s.c * 0.075;
  const cel = s.done !== undefined ? ramp(s.done, 0.15, 0.5) : 0;
  const lean = 0.2 * s.antic * (1 - s.air) - 0.08 * s.air + 0.14 * s.land * s.c - 0.05 * cel;
  B.pelvis.rotation.z = lean * 0.4; B.chest.rotation.z = lean * 0.6; B.chest.scale.set(1 + 0.035 * s.c, 1 - 0.06 * s.c + 0.04 * s.air, 1);
  P.root.updateMatrixWorld(true);
  foot(P, 'n', s.fn[0], s.fn[1], s.fn[1] > 0.02 ? -0.25 * Math.min(1, s.fn[1] / 0.1) : 0);
  foot(P, 'f', s.ff[0], s.ff[1], s.ff[1] > 0.02 ? 0.5 * Math.min(1, s.ff[1] / 0.15) : 0);
  const arm = 0.5 * sl.antic - 0.95 * sl.air + 0.15 * sl.land;
  B.sh_n.rotation.z = arm * (1 - cel) - 2.45 * cel + 0.06; B.el_n.rotation.z = (-0.25 - 0.4 * sl.air) * (1 - cel) - 0.35 * cel; B.wr_n.rotation.z = -0.15 * sl.air;
  B.sh_f.rotation.z = arm * 0.85 * (1 - cel) + 2.45 * cel - 0.05; B.el_f.rotation.z = (-0.2 - 0.35 * sl.air) * (1 - cel) + 0.35 * cel;
  B.neck.rotation.z = -lean * 0.5 + 0.1 * (1 - cel) - 0.03 * vy - 0.08 * cel + 0.02 * Math.sin(t * 9) * cel;
  secondary(P, t, vy, 0, 1); if (cel) { B.ear_l.rotation.z += 0.12 * cel; B.ear_r.rotation.z -= 0.12 * cel; }
  brows(P, -3 * (1 - cel) + 12 * cel, 0.08 * cel);
  return { s, cel };
}

// ---------- 骑车 ----------
function poseRide(P, t, x, z, speed, t0) {
  const d = speed * (t - t0), k = bike.userData.k;
  bike.visible = true; bike.position.set(x, 0, z); bike.scale.x = 1;
  const wr = bike.userData.wheelR, ang = d / wr; bike.userData.fw.rotation.z = ang; bike.userData.rw.rotation.z = ang;
  const ca = ang * 0.45; bike.userData.cr.rotation.z = ca;
  P.root.position.set(x + bike.userData.saddle[0] + 0.02, 0, z + 0.03); P.root.scale.x = 1;
  const B = P.B;
  B.pelvis.position.y = bike.userData.saddle[1] + 0.005 + 0.006 * Math.sin(ca * 2);
  B.pelvis.rotation.z = 0.25; B.chest.rotation.z = 0.15;
  P.root.updateMatrixWorld(true);
  const [ccx, ccy] = bike.userData.crank, L = bike.userData.crankLen;
  for (const [s, off] of [['n', 0], ['f', Math.PI]]) { const a = -ca + off; ik(P, 'leg_' + s, x + ccx + L * Math.cos(a), ccy + L * Math.sin(a) + P.lim['leg_' + s].ankleH * 0.6, -1, 0); }
  const [hx, hy] = bike.userData.bar;
  ik(P, 'arm_n', x + hx + 0.06, hy - 0.02, 1); ik(P, 'arm_f', x + hx + 0.09, hy - 0.01, 1);
  B.neck.rotation.z = -0.2;
  secondary(P, t, 0.3 * Math.sin(t * 6), speed, 1);
  B.ear_l.rotation.z += 0.25; B.ear_r.rotation.z -= 0.25;   // 风吹耳朵往后
}

// ---------- 镜头表 ----------
// 每个镜头：[开始, 结束, 场景, 函数(局部时间 lt, 全局时间 t)]。切点在小节线上。
const DB = SONG.downbeats;
const SB = (x) => BEATS.reduce((b, y) => Math.abs(y - x) < Math.abs(b - x) ? y : b, BEATS[0]);   // 吸附到最近的拍
const look = { x: 0, y: CAM.y };
function cam(x, y, z, tx = null) { camera.position.set(x, y, z); camera.lookAt(tx === null ? x * 0.6 : tx, y, -10); }
const kidHops1 = [{ i: 1, two: false }, { i: 2, two: false }, { i: 3, two: true }, { i: 4, two: false }, { i: 5, two: true }];
const hopLand0 = 14.23, HT = BEATS[1] - BEATS[0];
const hopT0 = hopLand0 - 0.62 * HT;
const SHOTS = [
  [0, 11.37, 'shed', (lt, t) => {   // 片头：撕纸框打开；大人拎包走来，停在粉笔格子前
    tornFrame(ramp(t, 0.3, 2.79)); setLight('dusk'); tintScene(SC.shed, [1, 1, 1]);
    const u = ramp(t, 0, 11.37); cam(lerp(1.0, 0.4, u), CAM.y, lerp(8.2, 6.9, u));
    const walkEnd = 8.6, s = 1.85 * ss(clamp((t - 2.4) / (walkEnd - 2.4)) * 0.85 + 0.15 * clamp((t - 2.4) / (walkEnd - 2.4)));
    adult.root.visible = true;
    if (t < walkEnd) { gait(adult, 3.4, 1.3, s, { dir: -1, stride: 0.5, t }); adult.B.case.rotation.z = -0.1 * Math.sin(s / 0.5 * Math.PI); }
    else { stand(adult, 3.4 - 1.85, 1.3, { t }); adult.B.neck.rotation.z = 0.16 * ramp(t, 8.8, 9.8); }
    secondary(adult, t, 0, t < walkEnd ? 0.3 : 0, 0.5); setFace(adult, blinkAt(t, [3.1, 6.2, 9.9]));
    brows(adult, 3 * ramp(t, 9.5, 10.5));
  }],
  [11.37, 17.09, 'shed', (lt, t) => {   // 回忆里的少年从地上立起来，跳格子
    setLight('dusk'); cam(0.3, CAM.y, 6.75);
    kid.root.visible = true;
    const r = poseHop(kid, t, (tt) => hopPlan(tt, hopT0, HT, kidHops1), HOP_Z + 0.05);
    kid.root.rotation.x = -Math.PI / 2 * (1 - ss((t - 11.5) / 0.6));   // 纸偶从地面立起
    setFace(kid, blinkAt(t, [12.6]));
    adultWatch(t, 0.4);
  }],
  [17.09, 19.95, 'shed', (lt, t) => {   // 跳到 7/8：举手大笑
    setLight('dusk'); const u = ramp(lt, 0, 2.86); cam(lerp(-0.9, -1.25, u), 1.42, lerp(4.6, 4.2, u));
    kid.root.visible = true;
    const r = poseHop(kid, t, (tt) => hopPlan(tt, hopT0, HT, kidHops1), HOP_Z + 0.05);
    setFace(kid, r.cel > 0.3 ? 2 : 0, r.cel > 0.3 ? 1 : 0);
    adultWatch(t, 0.4);
  }],
  [19.95, 22.81, 'shed', (lt, t) => {   // 大人特写：眯眼笑
    setLight('dusk'); const u = ramp(lt, 0, 2.86); cam(lerp(1.75, 1.6, u), 1.62, lerp(3.7, 3.4, u), lerp(1.2, 1.05, u));
    kid.root.visible = true; poseHop(kid, t, (tt) => hopPlan(tt, hopT0, HT, kidHops1), HOP_Z + 0.05); setFace(kid, 2, 1);
    adultWatch(t, 0.4); adult.B.neck.rotation.z = 0.1; setFace(adult, lt > 0.8 ? 1 : 0); brows(adult, 5 * ramp(lt, 0.5, 1.5), 0.05);
  }],
  [30.68, 36.40, 'shed', (lt, t) => {   // 走过一排一样颜色的自行车
    setLight('dusk'); kid.root.visible = true;
    const s = 3.3 * ss(clamp(lt / 4.6) * 0.8 + 0.2 * clamp(lt / 4.6)) * 0.98;
    if (lt < 4.6) gait(kid, 2.3, -1.7, s, { dir: -1, stride: 0.3, lift: 0.06, t });
    else { stand(kid, 2.3 - 3.3 * 0.98, -1.7, { t }); kid.B.neck.rotation.z = -0.12 * ramp(lt, 4.7, 5.2); }
    secondary(kid, t, 0, lt < 4.6 ? 0.6 : 0, 1); setFace(kid, blinkAt(lt, [1.2, 5.0]));
    cam(kid.root.position.x * 0.8 + 0.3, CAM.y, 6.2);
  }],
  [SB(117.61), 122.89, 'shed', (lt, t) => {   // 夜：少年骑车远去，大人留在格子里
    setLight('night'); nightScene(SC.shed, 1);
    cam(0.2, CAM.y, 6.9);
    kid.root.visible = true; poseRide(kid, t, lerp(1.0, -5.6, ramp(lt, 0, 5.3) * 0.6 + 0.4 * clamp(lt / 5.3)), -0.4, 1.3, SB(117.61));
    setFace(kid, 0);
    adult.root.visible = true; stand(adult, cellX(0), HOP_Z + 0.05, { t }); adult.B.neck.rotation.z = 0.05 - 0.04 * ramp(lt, 1, 4); setFace(adult, blinkAt(lt, [2.4]));
    brows(adult, 4, 0.08); secondary(adult, t, 0, 0, 0.4);
  }],
  [122.89, 147.03, 'shed', (lt, t) => {   // 结尾：纸灯一层层熄灭，只剩手心的硬币
    setLight('night');
    const off = (a, b) => 1 - ramp(t, a, b);
    // 纸灯一层层熄灭：先车棚里的灯，再楼里的窗，最后整个画面暗下去
    SC.shed.layers[2].userData.u.uGlow.value = off(128.6, 131.5);
    SC.shed.layers[1].userData.u.uGlow.value = off(131.5, 135.5);
    nightScene(SC.shed, 1, 1, [0.25 + 0.75 * off(135, 140), 0.2 + 0.8 * off(134, 139), 0.15 + 0.85 * off(136, 140.5)]);
    SC.shed.layers[2].userData.u.uGlow.value = off(128.6, 131.5); SC.shed.layers[1].userData.u.uGlow.value = off(131.5, 135.5);
    const gd = 0.12 + 0.88 * off(137, 141); SC.shed.ground.material.color.multiplyScalar(gd); SC.shed.chalk.material.color.multiplyScalar(0.2 + 0.8 * off(138, 142));
    amb.intensity = 0.75 * (0.25 + 0.75 * off(134, 141)); sun.intensity = 0.35 * off(130, 140);
    const u = ramp(t, 124, 143); cam(lerp(0.3, 0.62, u), lerp(CAM.y, 1.38, u), lerp(6.9, 3.0, u), lerp(0.2, 0.5, u));
    adult.root.visible = true; stand(adult, cellX(0), HOP_Z + 0.05, { t });
    const raise = ramp(t, 127, 129.5);
    adult.root.updateMatrixWorld(true);
    const ax = cellX(0) - 0.16, ay = lerp(0.62, 0.98, raise);
    if (raise > 0) { ik(adult, 'arm_n', ax, ay, 1); adult.B.wr_n.rotation.z += -0.6 * raise; }
    adult.B.neck.rotation.z = 0.05 + 0.2 * raise;
    setFace(adult, raise > 0.6 && t > 133 ? 1 : blinkAt(t, [125.5, 130.6])); brows(adult, 5 * raise, 0.1 * raise);
    adult.B.wr_n.getWorldPosition(coin.position); coin.position.x -= 0.03; coin.position.y += 0.02; coin.position.z += 0.03;
    coin.visible = raise > 0.05; coin.rotation.z = 0.3;
    coinGlow.position.copy(coin.position); coinGlow.position.z += 0.25; coinGlow.intensity = 1.6 * ramp(t, 129, 132);
    glowSprite.visible = coin.visible; glowSprite.position.copy(coin.position); glowSprite.position.z += 0.01; const gs = 0.25 * ramp(t, 129, 133) * (1 + 0.04 * Math.sin(t * 3)); glowSprite.scale.set(gs, gs, 1);
    tornFrame(1 - ramp(t, 143.5, 146.8));
    secondary(adult, t, 0, 0, 0.3);
  }],
];
// ---------- 其余场景的镜头 ----------
const Dof = (S, k) => k * S.Df, zAt = (S, k) => CAM.z - k * S.Df;
const xAt = (S, px, k) => S.imgToWorld(px, 600, k * S.Df).x;
// 从当前相机看，参考图里 (px,py)（在第 k 倍深度那层上）这条视线落到深度 z 时的高度
function sightY(S, px, py, k, z) { const P = S.imgToWorld(px, py, k * S.Df), c = camera.position; return c.y + (P.y - c.y) * (z - c.z) / (P.z - c.z); }
function popUp(S, t, starts, dur = 0.45) {   // 立体书：每层从平躺立起，带一点回弹
  S.layers.forEach((m, i) => {
    const u = clamp((t - starts[i]) / dur), back = 1 + 2.2 * Math.pow(u - 1, 3) + 1.2 * Math.pow(u - 1, 2) * (u >= 1 ? 0 : 1);
    const e = u >= 1 ? 1 : clamp(1 - Math.pow(1 - u, 3) * (1 - 1.6 * u), 0, 1.08);
    const th = (1 - e) * Math.PI / 2, Hh = m.geometry.parameters.height / 2, b = m.userData.base;
    m.rotation.x = -th; m.position.set(b.x, b.y - Hh + Hh * Math.cos(th), b.z - Hh * Math.sin(th));
  });
}
function unPop(S) { S.layers.forEach((m) => { m.rotation.x = 0; m.position.copy(m.userData.base); }); }
const SHOTS2 = [
  [22.81, 30.68, 'classroom', (lt, t) => {   // 写愿望作文，写着写着望向窗外
    setLight('dusk'); const S = SC.classroom, zk = zAt(S, 1.0) + 1.7, kx = -0.35;
    const u = ramp(lt, 0, 7.87); cam(kx + lerp(0.15, 0.35, u), 1.45, zk + lerp(4.6, 4.0, u), kx + lerp(0.05, 0.25, u));
    desk.visible = true; desk.position.set(kx + 0.12, desk.userData.h / 2, zk + 0.16);
    const deskY = desk.userData.top;
    kid.root.visible = true; stand(kid, kx, zk, { face: -1, t, crouch: 0 });
    kid.B.pelvis.position.y = deskY - 0.2; kid.root.updateMatrixWorld(true); foot(kid, 'n', kx + 0.13, 0); foot(kid, 'f', kx + 0.2, 0);
    const look = ramp(lt, 3.6, 4.4), write = 1 - look;
    const wx = 0.012 * Math.sin(t * 22) * write, wy = 0.006 * Math.sin(t * 33) * write;
    kid.root.updateMatrixWorld(true);
    ik(kid, 'arm_n', kx + 0.2 + wx, deskY + 0.02 + wy + 0.12 * look, 1); ik(kid, 'arm_f', kx + 0.1, deskY + 0.02 + 0.03 * look, 1);
    if (look > 0.5) kid.B.wr_n.rotation.z += 0.8 * look;
    kid.B.chest.rotation.z = 0.12 * write - 0.04 * look; kid.B.neck.rotation.z = 0.24 * write - 0.12 * look + 0.02 * Math.sin(t * 1.3) * look;
    setFace(kid, look > 0.5 ? blinkAt(lt, [5.2, 7.0]) : (lt > 1.5 && lt < 1.67 ? 1 : 0)); brows(kid, -2 * write + 9 * look, 0.06 * look);
    secondary(kid, t, 0, 0, 0.6);
  }],
  [36.40, 44.98, 'wall', (lt, t) => {   // 翻墙：从墙后扒上墙头，坐下晃腿
    setLight('dusk'); const S = SC.wall, zw = zAt(S, 1.0), kx = xAt(S, 760, 1.0);
    const yTop = sightY(S, 760, 600, 1.0, zw);
    cam(kx + 0.5, 1.95, zw + lerp(5.6, 5.0, ramp(lt, 0, 8.6)), kx + 0.3);
    kid.root.visible = lt > 0.6; const B = kid.B, sh = 0.64;
    const front = lt > 3.55, z = front ? zw + 0.1 : zw - 0.12;
    kid.root.position.set(kx, 0, z); kid.root.scale.x = 1;
    let ry;
    if (lt < 3.4) {   // 跳起扒墙、引体、上腿
      const j = ramp(lt, 0.7, 1.15), pull = ramp(lt, 1.4, 2.6), up = ramp(lt, 2.6, 3.4);
      ry = lerp(0, yTop - 0.12 - sh, j) + pull * 0.42 + up * 0.25;
      kid.root.position.y = ry; kid.root.updateMatrixWorld(true);
      ik(kid, 'arm_n', kx - 0.12, yTop + 0.02, 1); ik(kid, 'arm_f', kx + 0.1, yTop + 0.02, 1);
      ik(kid, 'leg_n', kx - 0.05 + 0.04 * Math.sin(t * 9) * (1 - up), ry + 0.05 + 0.1 * pull, -1);
      ik(kid, 'leg_f', lerp(kx + 0.06, kx + 0.12, up), lerp(ry + 0.06 + 0.06 * Math.sin(t * 9 + 2), yTop + 0.06, up), -1);
      B.chest.rotation.z = 0.1 * pull; B.neck.rotation.z = -0.1 + 0.12 * pull;
      setFace(kid, 0); brows(kid, -4);
    } else {          // 坐在墙头，腿在墙外晃
      ry = yTop + 0.04 - kid.pelvisH; kid.root.position.y = ry; kid.root.updateMatrixWorld(true);
      const sw = Math.sin(t * 3.2);
      ik(kid, 'leg_n', kx - 0.1 + 0.05 * sw, yTop - 0.3 + 0.04 * sw, -1, -0.2); ik(kid, 'leg_f', kx + 0.02 - 0.05 * sw, yTop - 0.3 - 0.04 * sw, -1, -0.2);
      ik(kid, 'arm_n', kx - 0.15, yTop + 0.03, 1); ik(kid, 'arm_f', kx + 0.15, yTop + 0.03, 1);
      B.neck.rotation.z = -0.14 * ramp(lt, 4.2, 5); setFace(kid, blinkAt(lt, [5.8, 7.6])); brows(kid, 6 * ramp(lt, 4.2, 5));
    }
    secondary(kid, t, lt < 3.4 ? 0.4 * Math.sin(t * 5) : 0, 0, 1);
  }],
  [44.98, 53.56, 'wall', (lt, t) => {   // 站上墙头张开手走，跳下来跑掉；大人在路灯下看
    setLight('dusk'); const S = SC.wall, zw = zAt(S, 1.0), kx0 = xAt(S, 760, 1.0);
    const yTop = sightY(S, 760, 600, 1.0, zw + 0.1);
    cam(lerp(kx0 + 0.5, kx0 - 0.4, ramp(lt, 2, 8)), lerp(1.85, 1.35, ramp(lt, 5.8, 6.8)), zw + lerp(5.4, 6.4, ramp(lt, 5.8, 6.8)), null);
    kid.root.visible = true; const B = kid.B, z = zw + 0.1;
    if (lt < 1.4) {
      kid.root.position.set(kx0, yTop + 0.04 - kid.pelvisH, z); kid.root.updateMatrixWorld(true); const sw = Math.sin(t * 3.2);
      ik(kid, 'leg_n', kx0 - 0.1 + 0.05 * sw, yTop - 0.3, -1, -0.2); ik(kid, 'leg_f', kx0 + 0.02 - 0.05 * sw, yTop - 0.3, -1, -0.2);
      ik(kid, 'arm_n', kx0 - 0.15, yTop + 0.03, 1); ik(kid, 'arm_f', kx0 + 0.15, yTop + 0.03, 1); B.neck.rotation.z = -0.14;
      setFace(kid, 0);
    } else if (lt < 5.6) {
      kid.groundY = yTop; const s = 0.9 * ramp(lt, 2.6, 5.6);
      if (lt < 2.6) stand(kid, kx0, z, { t, crouch: 1 - ramp(lt, 1.4, 2.4) });
      else gait(kid, kx0, z, s, { dir: -1, stride: 0.22, lift: 0.04, t });
      const wob = 0.15 * Math.sin(t * 4.5);
      B.sh_n.rotation.z = -1.35 + wob; B.sh_f.rotation.z = 1.35 + wob; B.el_n.rotation.z = -0.15; B.el_f.rotation.z = 0.15;
      B.chest.rotation.z = 0.06 * Math.sin(t * 4.5 + 1); setFace(kid, 0); brows(kid, 4, 0.05);
    } else {
      const xj = kx0 - 0.9, xl = xj - 0.35, a = ramp(lt, 5.6, 6.35), land = ramp(lt, 6.35, 6.8);
      if (lt < 6.8) {
        const yb = lerp(yTop, 0, a) + Math.sin(a * Math.PI) * 0.25, zz = lerp(z, z + 0.5, a);
        kid.groundY = yb; stand(kid, lerp(xj, xl, a), zz, { t, crouch: lt < 6.35 ? 0.4 * Math.sin(a * Math.PI) : Math.sin(land * Math.PI) * 0.9 });
        if (lt < 6.35 && a > 0.05) { kid.root.updateMatrixWorld(true); foot(kid, 'n', lerp(xj, xl, a) - 0.05, 0.12 * Math.sin(a * Math.PI)); foot(kid, 'f', lerp(xj, xl, a) + 0.08, 0.16 * Math.sin(a * Math.PI)); }
        B.sh_n.rotation.z = -1.6 * Math.sin(a * Math.PI); B.sh_f.rotation.z = 1.6 * Math.sin(a * Math.PI);
        setFace(kid, a > 0.2 && a < 0.9 ? 0 : 0, 0); brows(kid, 8 * Math.sin(a * Math.PI));
      } else {
        gait(kid, xl, z + 0.5, 1.4 * (lt - 6.8), { dir: -1, stride: 0.5, run: true, lift: 0.12, lean: 0.14, t }); setFace(kid, 0, 1); brows(kid, 8);
      }
    }
    secondary(kid, t, 0, lt > 6.8 ? 1.4 : 0, 1);
    adult.root.visible = true; const ax = xAt(S, 1180, 1.0) + 0.2; stand(adult, ax, zw + 0.9, { t });
    adult.B.neck.rotation.z = 0.05 + 0.04 * ramp(lt, 5, 7); setFace(adult, blinkAt(lt, [1.5, 4.8, 7.5])); brows(adult, 3, 0.05); secondary(adult, t, 0, 0, 0.4);
  }],
  [53.56, 62.14, 'arcade', (lt, t) => {   // 走进游戏厅，掏出硬币，投币那一下屏幕亮
    setLight('arcade'); const S = SC.arcade, z = zAt(S, 1.0) + 0.14, slot = xAt(S, 1135, 1.0), door = xAt(S, 1760, 1.0);
    kid.root.visible = true;
    const walkEnd = 2.6, s = (door - (slot + 0.12)) * ramp(lt, 0, walkEnd);
    if (lt < walkEnd) gait(kid, door, z, s, { dir: -1, stride: 0.3, lift: 0.06, t });
    else stand(kid, slot + 0.12, z, { t, crouch: 0.25 * ramp(lt, 4.9, 5.4) * (1 - ramp(lt, 6.0, 6.5)) });
    kid.root.updateMatrixWorld(true);
    const look = ramp(lt, 3.0, 3.6) * (1 - ramp(lt, 4.8, 5.2)), ins = ramp(lt, 5.0, 5.7);
    if (lt > walkEnd) {
      if (ins > 0) ik(kid, 'arm_n', lerp(slot + 0.02, slot - 0.02, ins), lerp(0.75, 0.56, ins), 1);
      else if (look > 0) ik(kid, 'arm_n', slot + 0.02, lerp(0.45, 0.8, look), 1);
    }
    coin.visible = lt > 2.9 && lt < 5.75; if (coin.visible) { kid.B.wr_n.getWorldPosition(coin.position); coin.position.y -= 0.03; coin.position.z += 0.04; coin.rotation.z = 0.2 + lt; }
    kid.B.neck.rotation.z = 0.12 * look + 0.06 * ins; brows(kid, 6 * look, 0.05 * look);
    setFace(kid, blinkAt(lt, [1.4, 4.4]), lt > 5.8 ? 1 : 0);
    secondary(kid, t, 0, lt < walkEnd ? 0.5 : 0, 1);
    arcadeScreen(S, t, ramp(t, 59.28, 59.5));
    cam(lerp(slot + 0.9, slot + 0.35, ramp(lt, 0, 6)), 1.25, z + lerp(5.2, 4.2, ramp(lt, 0, 8.6)), null);
  }],
  [62.14, 72.86, 'arcade', (lt, t) => {   // 站在圆凳上打游戏；大人出现在门帘边
    setLight('arcade'); const S = SC.arcade, z = zAt(S, 1.0) + 0.14, slot = xAt(S, 1135, 1.0), stool = xAt(S, 1070, 1.0);
    const stoolTop = sightY(S, 1070, 893, 1.0, z);
    kid.root.visible = true; kid.groundY = stoolTop; stand(kid, stool, z, { t, crouch: 0.15 + 0.05 * Math.sin(t * 7) });
    kid.root.updateMatrixWorld(true);
    const panelY = sightY(S, 1080, 770, 1.0, z), jig = Math.sin(t * 17) * 0.015, mash = Math.abs(Math.sin(t * 11)) * 0.02;
    ik(kid, 'arm_n', stool - 0.17 + jig, panelY + 0.03, 1); ik(kid, 'arm_f', stool - 0.04, panelY + 0.03 + mash, 1);
    kid.B.neck.rotation.z = -0.1 + 0.03 * Math.sin((t - BEATS[0]) / HT * Math.PI); kid.B.chest.rotation.z = 0.04 * Math.sin(t * 2.3);
    setFace(kid, blinkAt(lt, [2.5, 6.1, 9.0]), lt > 7 ? 1 : 0); brows(kid, -4 + 10 * ramp(lt, 6.6, 7.2), 0.04);
    secondary(kid, t, 0.15 * Math.sin(t * 7), 0, 1);
    arcadeScreen(S, t, 1);
    const ad = lt > 4.1; adult.root.visible = ad;
    if (ad) { const ax = xAt(S, 1700, 1.0); stand(adult, ax, z + 0.25, { t }); adult.B.neck.rotation.z = 0.06; setFace(adult, blinkAt(lt, [6.2, 8.8])); brows(adult, 5, 0.12); secondary(adult, t, 0, 0, 0.4); }
    const u = ramp(lt, 0, 10.7); cam(lerp(stool + 0.25, stool + 1.0, ramp(lt, 3.6, 6)), 1.3, z + lerp(3.8, 5.6, ramp(lt, 3.6, 6)), null);
  }],
  [72.86, 75.72, 'arcade', (lt, t) => {   // 跳下圆凳，从大人身边跑出门
    setLight('arcade'); const S = SC.arcade, z = zAt(S, 1.0) + 0.14, stool = xAt(S, 1070, 1.0), ax = xAt(S, 1700, 1.0);
    kid.root.visible = true;
    if (lt < 0.5) { kid.groundY = sightY(S, 1070, 893, 1.0, z) * (1 - ramp(lt, 0.15, 0.45)); stand(kid, stool, z, { face: -1, t, crouch: 0.5 * Math.sin(ramp(lt, 0, 0.5) * Math.PI) }); }
    else gait(kid, stool, z + 0.1, 1.6 * (lt - 0.5), { dir: 1, stride: 0.5, run: true, lift: 0.12, lean: 0.14, t });
    setFace(kid, 0, 1); brows(kid, 8); secondary(kid, t, 0, 1.2, 1);
    adult.root.visible = true; stand(adult, ax, z + 0.25, { t }); adult.B.neck.rotation.z = 0.06 - 0.05 * ramp(lt, 0.8, 1.8); setFace(adult, lt > 1.5 ? 1 : 0); brows(adult, 6, 0.14);
    arcadeScreen(S, t, 1);
    cam(stool + 1.1, 1.3, z + 5.6, null);
  }],
  [75.72, 84.30, 'night_street', (lt, t) => {   // 副歌第一拍：夜街像立体书一样立起来，少年冲进来
    setLight('night'); const S = SC.night_street, z = zAt(S, 1.0) + 2.2;
    popUp(S, t, [76.15, 76.35, 76.6, 76.8]);
    renderer.setClearColor(0x0d1430);
    const run = Math.max(0, t - 76.2);
    kid.root.visible = true; gait(kid, 3.6, z, 1.05 * run, { dir: -1, stride: 0.55, run: true, lift: 0.14, lean: 0.16, t });
    cam(lerp(1.6, kid.root.position.x * 0.55, ramp(t, 76.2, 77.6)), lerp(2.6, 1.55, ramp(t, 76.4, 77.2)), lerp(9.5, z + 6.2, ramp(t, 75.9, 77.4)), null);
    setFace(kid, 0, 1); brows(kid, 9, 0.05); secondary(kid, t, 0, 1.2, 1);
  }],
  [84.30, 90.02, 'night_street', (lt, t) => {   // 路灯下跑
    setLight('night'); const S = SC.night_street, z = zAt(S, 1.0) + 2.6;
    kid.root.visible = true; gait(kid, 2.4, z, 0.95 * lt, { dir: -1, stride: 0.55, run: true, lift: 0.14, lean: 0.16, t });
    cam(kid.root.position.x * 0.8 + 0.25, 1.5, z + 4.3, null);
    setFace(kid, blinkAt(lt, [2.2]), 1); brows(kid, 8); secondary(kid, t, 0, 1.2, 1);
  }],
  [90.02, SB(94.81), 'night_street', (lt, t) => {   // 在黑夜里舞蹈：转圈
    setLight('night'); const S = SC.night_street, z = zAt(S, 1.0) + 2.6, x = -0.6;
    kid.root.visible = true; const sp = ramp(lt, 0.3, 1.0) * (1 - ramp(lt, 4.2, 4.7));
    const ph = (lt - 0.3) * 2.2 * Math.PI * sp;
    const hop = Math.abs(Math.sin((t - BEATS[0]) / HT * Math.PI)) * 0.05 * sp;
    kid.groundY = hop; stand(kid, x, z, { t, crouch: 0.15 * sp });
    kid.root.scale.x = Math.cos(ph) >= 0 ? Math.max(0.12, Math.cos(ph)) : Math.min(-0.12, Math.cos(ph));
    kid.B.sh_n.rotation.z = -1.5 * sp - 0.2 * Math.sin(ph); kid.B.sh_f.rotation.z = 1.5 * sp + 0.2 * Math.sin(ph); kid.B.el_n.rotation.z = -0.3; kid.B.el_f.rotation.z = 0.3;
    kid.B.neck.rotation.z = -0.12 * sp;
    cam(x + 0.2, 1.45, z + 3.6 - 0.3 * ramp(lt, 0, 4.8), x);
    setFace(kid, sp > 0.5 ? 2 : 0, 1); brows(kid, 10 * sp, 0.06); secondary(kid, t, 0.4 * Math.sin(ph * 2), 1.0 * sp, 1);
  }],
  [SB(94.81), SB(99.85), 'night_street', (lt, t) => {   // 蹲在水洼边放纸船
    setLight('night'); const S = SC.night_street, z = zAt(S, 1.0) + 1.4, x = -0.9;
    kid.root.visible = true; const c = ramp(lt, 0.3, 1.0) * (1 - ramp(lt, 3.8, 4.4));
    stand(kid, x, z, { t, crouch: c * 1.6 }); kid.B.chest.rotation.z = 0.35 * c; kid.B.neck.rotation.z = 0.25 * c;
    const rel = ramp(lt, 2.0, 2.6);
    kid.root.updateMatrixWorld(true);
    const hx = x - 0.2 - 0.06 * rel, hy = lerp(0.36, 0.2, c);
    ik(kid, 'arm_n', hx, hy, 1); ik(kid, 'arm_f', hx + 0.08, hy + 0.02, 1);
    boat.visible = true;
    if (rel < 1) { boat.position.set(hx - 0.04, Math.max(0.06, hy - 0.02), z + 0.06); boat.rotation.set(0, 0, 0.1); }
    else {   // 漂到背景里那摊水的视线位置上
      const u = lt - 2.6, P = S.imgToWorld(640, 1072, S.Df), c = camera.position, zb = z + 0.06, sr = (zb - c.z) / (P.z - c.z);
      const tx = c.x + (P.x - c.x) * sr, ty = c.y + (P.y - c.y) * sr, e = ss(u / 1.6);
      boat.position.set(lerp(hx - 0.04, tx, e) - 0.03 * Math.max(0, u - 1.6), lerp(0.06, ty + 0.03, e) + 0.008 * Math.sin(u * 4), zb); boat.rotation.set(0, 0, 0.06 * Math.sin(u * 3));
    }
    cam(x - 0.4, 1.42, z + 4.6, x - 0.5);
    setFace(kid, lt > 3 ? blinkAt(lt, [3.4]) : 0, lt > 3.3 ? 1 : 0); brows(kid, 5 * rel); secondary(kid, t, 0, 0, 0.7);
  }],
  [SB(99.85), SB(105.53), 'bus_station', (lt, t) => {   // 第二遍副歌：雨里，大人一个人站在车棚下
    setLight('rain'); const S = SC.bus_station, z = zAt(S, 1.0) + 1.2, ax = xAt(S, 520, 1.0) + 0.4;
    adult.root.visible = true; stand(adult, ax, z, { face: -1, t });
    adult.B.neck.rotation.z = 0.06; setFace(adult, blinkAt(lt, [1.8, 4.4])); brows(adult, 5, 0.12); secondary(adult, t, 0, 0, 0.4);
    const u = ramp(lt, 0, 5.7); cam(lerp(ax + 1.2, ax + 0.6, u), 1.55, lerp(z + 6.0, z + 4.4, u), null);
  }],
  [SB(105.53), SB(111.21), 'bus_station', (lt, t) => {   // 少年背着书包走过大人身边，上车
    setLight('rain'); const S = SC.bus_station, z = zAt(S, 1.0) + 1.2, ax = xAt(S, 520, 1.0) + 0.4, door = xAt(S, 860, 1.0);
    adult.root.visible = true; stand(adult, ax, z, { face: -1, t });
    kid.root.visible = true; const zk = lt < 4.6 ? z + 0.55 : zAt(S, 1.0) - 0.05;
    const s = (door - (ax - 1.6)) * ramp(lt, 0, 4.6) * 0.98 + 0.25 * Math.max(0, lt - 4.6);
    gait(kid, ax - 1.6, zk, s, { dir: 1, stride: 0.34, lift: 0.06, t });
    kid.root.visible = lt < 5.2; setFace(kid, 0); brows(kid, -2); secondary(kid, t, 0, 0.6, 1);
    adult.B.neck.rotation.z = 0.08 - 0.06 * ramp(lt, 1, 3); setFace(adult, lt > 4.8 ? 1 : blinkAt(lt, [0.8, 3.6])); brows(adult, 6, 0.14); secondary(adult, t, 0, 0, 0.4);
    cam(ax + 0.4, 1.5, z + 5.0, null);
  }],
  [SB(111.21), SB(117.61), 'bus_station', (lt, t) => {   // 车开走，大人抬了一下手又放下
    setLight('rain'); const S = SC.bus_station, z = zAt(S, 1.0) + 1.2, ax = xAt(S, 520, 1.0) + 0.4;
    if (busMesh) { const d = 0.6 * Math.pow(Math.max(0, lt - 1.0), 2); busMesh.position.x = busMesh.userData.base.x + d; }
    adult.root.visible = true; stand(adult, ax, z, { face: -1, t });
    const wave = ramp(lt, 2.2, 3.0) * (1 - ramp(lt, 4.6, 5.6));
    adult.root.updateMatrixWorld(true);
    if (wave > 0.01) { ik(adult, 'arm_n', ax + 0.18 + 0.1 * wave, lerp(0.7, 1.3, wave), 1); adult.B.wr_n.rotation.z += 0.3 * Math.sin(t * 6) * wave; }
    adult.B.neck.rotation.z = 0.02 + 0.1 * ramp(lt, 4.8, 6); setFace(adult, lt > 5 ? 1 : blinkAt(lt, [1.2])); brows(adult, 6, 0.16); secondary(adult, t, 0, 0, 0.4);
    const u = ramp(lt, 0, 6.4); cam(lerp(ax + 0.9, ax + 0.15, u), lerp(1.5, 1.62, u), lerp(z + 5.0, z + 3.2, u), null);
  }],
];

SHOTS.push(...SHOTS2); SHOTS.sort((a, b) => a[0] - b[0]);
function arcadeScreen(S, t, on) {
  if (on <= 0) return; const d = 0.995 * S.Df, p0 = S.imgToWorld(990, 598, d), p1 = S.imgToWorld(1172, 722, d);
  screenGlow.visible = true; screenGlow.scale.set(p1.x - p0.x, p0.y - p1.y, 1); screenGlow.position.set((p0.x + p1.x) / 2, (p0.y + p1.y) / 2, p0.z + 0.01);
  screenGlow.material.opacity = on * (0.55 + 0.25 * Math.sin(t * 13)); screenGlow.material.map.offset.set(Math.floor(t * 6) * 0.13 % 1, 0); screenGlow.material.map.wrapS = THREE.RepeatWrapping;
}
function adultWatch(t, lag) {
  adult.root.visible = true; stand(adult, 1.62, 1.3, { t });
  const kx = kid.root.position.x; adult.B.neck.rotation.z = 0.04 + 0.05 * (cellX(0) - kx) / (CELL * 5);
  secondary(adult, t, 0, 0, 0.4); setFace(adult, blinkAt(t, [13.4, 16.2, 18.8]));
}
function setLight(mode) {
  if (mode === 'arcade') { amb.color.set(0xffe6cc); amb.intensity = 1.45; sun.color.set(0xffd0a0); sun.intensity = 0.7; return; }
  if (mode === 'rain') { amb.color.set(0xd6e2f5); amb.intensity = 1.35; sun.color.set(0xdfe8ff); sun.intensity = 0.55; return; }
  if (mode === 'night') { amb.color.set(0xa8b8ff); amb.intensity = 0.75; sun.color.set(0xa0b0ff); sun.intensity = 0.35; }
  else { amb.color.set(0xfff1e2); amb.intensity = 1.55; sun.color.set(0xffd7a8); sun.intensity = 1.1; }
}

// 还没做的镜头：黑底字卡占位（粗剪先让时间线完整）
const holdTex = {};
function placeholder(label) { return null; }

window.renderAt = (t) => {
  const shot = SHOTS.find((s) => t >= s[0] && t < s[1]);
  for (const S of Object.values(SC)) if (S) S.group.visible = false;
  for (const P of [kid, adult]) { resetPose(P); P.root.visible = false; }
  for (const S0 of Object.values(SC)) if (S0) unPop(S0); if (busMesh) busMesh.position.copy(busMesh.userData.base); puddle.visible = false; boat.visible = false; desk.visible = false; screenGlow.visible = false; renderer.setClearColor(0x15100c);
  bike.visible = false; coin.visible = false; glowSprite.visible = false; coinGlow.intensity = 0; frameGroup.visible = false;
  for (const S0 of Object.values(SC)) if (S0) nightScene(S0, 0);
  let S = null;
  if (shot && SC[shot[2]]) { S = SC[shot[2]]; S.group.visible = true; shot[3](t - shot[0], t); }
  else { setLight('dusk'); cam(0, CAM.y, 6.6); }
  // 环境
  const zf = S ? S.zFloor : -3;
  poseDust(t, zf + 0.3, S && S.name === 'shed' ? 1 : 0);
  poseLeaves(t, !!S && S.name === 'shed' && t < 40, [[-3.2, 0, 0.4], [-1.2, 1.3, 1.6], [0.6, 2.4, 0.7], [-2.2, 3.4, -0.6], [1.6, 4.4, 0.2]]);
  poseRain(t, !!S && S.name === 'bus_station', 1);
  scene.updateMatrixWorld(true);
  footBlobs(kid, kidBlobs); footBlobs(adult, adultBlobs);
  if (!shot || !S) { renderer.setClearColor(0x15100c); }
  renderer.render(scene, camera); return { shot: shot ? SHOTS.indexOf(shot) : -1 };
};
window.SHOT_TIMES = SHOTS.map((s) => [s[0], s[1], s[2]]);
window.DBG = { THREE, camera, kid, adult, SC, bike };
window.renderAt(Number(new URLSearchParams(location.search).get('t') || 0));
window.READY = true;
