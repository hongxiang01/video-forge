// lib3d.js —— 三渲二管线：three 渲到离屏 canvas → g.drawImage 进颜色层；发光层 e 上印三维物件的黑色剪影（挡光）。之后照常走 CRT 后期。
// 卡通材质：MeshToonMaterial + 硬边 RGB 渐变贴图 [暗阶, 亮阶, 高光阶]：暗阶 = 影色 / 亮色、高光阶 = 高光 / 亮色（逐通道比值），
//   亮阶 = 1 → 受光面正好是色指定 lit，背光面和落在它身上的投影正好是 sh（三维只决定「哪里亮、哪里暗」，颜色全由色指定给）。
// 场景里只放一盏白色方向光（强度 1）、不放环境光：暗部不会被提平。落影系数取 .5 做阈值 → 投影也是硬边。
// 描边：OutlineEffect（背面外扩），每个材质用自己的描边色（pal.js 的 line，彩色描边，不用纯黑）。
// 内部线（第 2 版加）：外轮廓只描剪影，手指压在手掌上、指缝、指节折起来的地方没有线。另渲一张法线 + 深度图、一张「描边色」图，
//   逐像素和右、下邻居比：深度跳变（远的那一侧）或法线转折超过阈值 → 画 1 px 细线，颜色 = 该物件自己的描边色；邻居是空背景时不画（外轮廓已有）。
//   只作用在三维层：userData.bg 的台面 / 收影平面、描边关掉的材质（line: false）不参与；scene.userData.inner = false 整场关掉。
import * as THREE from 'three';
import { OutlineEffect } from 'three/addons/effects/OutlineEffect.js';
import { W, H, hex } from './lib/cel.js';

THREE.ColorManagement.enabled = false;   // 色指定是 sRGB 十六进制：按数字原样进出，不做线性转换

let R = null;
export function renderer() {
  if (R) return R;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const r = new THREE.WebGLRenderer({ canvas: c, alpha: true, antialias: true, preserveDrawingBuffer: true });
  r.setPixelRatio(1); r.setSize(W, H, false);
  r.outputColorSpace = THREE.LinearSRGBColorSpace;   // 不转换（配合上面关掉的色彩管理）
  r.setClearColor(0x000000, 0);
  r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFShadowMap;
  const fx = new OutlineEffect(r, { defaultThickness: 0.0032, defaultColor: [0, 0, 0], defaultAlpha: 1, defaultKeepAlive: true });
  return (R = { r, c, fx, sil: new THREE.MeshBasicMaterial({ color: 0x000000 }) });
}

// 卡通光照：dotNL ≥ T 且不在落影里 → 亮阶；dotNL ≥ HI 再进高光阶。不加环境光（RE_IndirectDiffuse 留空）
const TOON = /* glsl */`
varying vec3 vViewPosition;
struct ToonMaterial { vec3 diffuseColor; };
void RE_Direct_Toon( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
  float d = dot( geometryNormal, directLight.direction );
  float lit = step( TOON_T, d ) * step( .5, directLight.color.r );
  float hi = lit * step( TOON_HI, d );
  reflectedLight.directDiffuse += texture2D( gradientMap, vec2( ( .5 + lit + hi ) / 3., .5 ) ).rgb * material.diffuseColor;
}
void RE_IndirectDiffuse_Toon( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {}
#define RE_Direct RE_Direct_Toon
#define RE_IndirectDiffuse RE_IndirectDiffuse_Toon
`;
export const rgb = x => hex(x).map(v => v / 255);

// c = pal.js 的 C(...) → { f, s, l, h }；o = { t: 明暗分界（dotNL），hi: 高光分界（不给 = 没有高光阶），w: 描边粗细（NDC），line: false 不描边，map }
export function toon(c, o = {}) {
  const F = rgb(c.f), S = rgb(c.s), Hh = rgb(c.h || c.f), q = (A, i) => A[i] / Math.max(F[i], 1e-3);
  const gm = new THREE.DataTexture(new Float32Array([q(S, 0), q(S, 1), q(S, 2), 1, 1, 1, 1, 1, q(Hh, 0), q(Hh, 1), q(Hh, 2), 1]), 3, 1, THREE.RGBAFormat, THREE.FloatType);
  gm.minFilter = gm.magFilter = THREE.NearestFilter; gm.generateMipmaps = false; gm.needsUpdate = true;
  const m = new THREE.MeshToonMaterial({ color: new THREE.Color(c.f), gradientMap: gm, map: o.map || null });
  const t = (o.t ?? 0.05).toFixed(3), hi = (o.hi ?? 2).toFixed(3);
  m.onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.replace('#include <lights_toon_pars_fragment>', TOON.replace('TOON_T', t).replace('TOON_HI', hi)); };
  m.customProgramCacheKey = () => `toon_${t}_${hi}`;
  m.userData.outlineParameters = { thickness: o.w ?? 0.0032, color: rgb(c.l), alpha: 1, visible: o.line !== false };
  return m;
}

// 一盏白色方向光（强度 1，带硬边投影）。from = 光从哪个方向来（单位不限），box = 投影相机半宽（米），at = 照向的点
export function sun(scene, from, box = 0.6, at = [0, 0, 0]) {
  const L = new THREE.DirectionalLight(0xffffff, 1), v = new THREE.Vector3(...from).normalize();
  L.position.set(at[0] + v.x * 3, at[1] + v.y * 3, at[2] + v.z * 3); L.target.position.set(...at);
  L.castShadow = true; L.shadow.mapSize.set(4096, 4096);
  Object.assign(L.shadow.camera, { left: -box, right: box, top: box, bottom: -box, near: 0.5, far: 6 }); L.shadow.camera.updateProjectionMatrix();
  L.shadow.bias = -0.0004; L.shadow.normalBias = 0.002;
  scene.add(L, L.target);
  return L;
}

// —— 内部线：法线 + 深度 → 1 px 细线（描边色）——
// 阈值：深度差 > INNER.dz + INNER.dzk × 距离（米），或法线夹角余弦 < INNER.dn。镜头组可以在 scene.userData.innerOpt 里覆盖这三个数。
export const INNER = { dz: 0.004, dzk: 0.006, dn: 0.72 };
let IN = null;
function innerKit() {
  if (IN) return IN;
  const mk = depth => { const t = new THREE.WebGLRenderTarget(W, H, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, type: THREE.UnsignedByteType }); if (depth) { t.depthTexture = new THREE.DepthTexture(W, H); t.depthTexture.type = THREE.UnsignedIntType; } return t; };
  const nrm = new THREE.MeshNormalMaterial();
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    uniforms: { tN: { value: null }, tD: { value: null }, tL: { value: null }, px: { value: new THREE.Vector2(1 / W, 1 / H) }, near: { value: .05 }, far: { value: 20 }, ortho: { value: 0 }, dz: { value: INNER.dz }, dzk: { value: INNER.dzk }, dn: { value: INNER.dn } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }',
    fragmentShader: /* glsl */`
      #include <packing>
      uniform sampler2D tN, tD, tL; uniform vec2 px; uniform float near, far, ortho, dz, dzk, dn; varying vec2 vUv;
      float vz(vec2 u) { float d = texture2D(tD, u).x; return ortho > .5 ? -orthographicDepthToViewZ(d, near, far) : -perspectiveDepthToViewZ(d, near, far); }
      vec3 nn(vec2 u) { return normalize(texture2D(tN, u).xyz * 2. - 1.); }
      void main() {
        vec4 L = texture2D(tL, vUv);
        if (L.a < .5) { gl_FragColor = vec4(0.); return; }
        float z = vz(vUv); vec3 n = nn(vUv); float edge = 0.;
        vec2 o[4]; o[0] = vec2(px.x, 0.); o[1] = vec2(-px.x, 0.); o[2] = vec2(0., px.y); o[3] = vec2(0., -px.y);
        for (int i = 0; i < 4; i++) {
          vec2 u = vUv + o[i];
          if (texture2D(tL, u).a < .5) continue;                       // 邻居是空背景：外轮廓已经有线
          float zi = vz(u);
          if (z - zi > dz + dzk * z) edge = 1.;                          // 我在远的一侧：线画在被挡住的那一面
          if ((i == 0 || i == 2) && dot(n, nn(u)) < dn) edge = 1.;       // 法线急转：只和右、下邻居比 → 线宽 1 px
        }
        gl_FragColor = vec4(L.rgb * edge, edge);                          // 画布是预乘 alpha：没线的地方必须是 (0,0,0,0)，否则会把颜色加亮
      }`,
    depthTest: false, depthWrite: false, transparent: false,
  }));
  const qs = new THREE.Scene(); qs.add(quad); quad.frustumCulled = false;
  return (IN = { tn: mk(true), tl: mk(false), nrm, quad, qs, qc: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), lm: new Map() });
}
function lineMat(m) {   // 每个材质对应一个纯色材质（它的描边色）；没描边的材质 → 透明（不画线，但照样挡住后面的线）
  const K = innerKit(); let b = K.lm.get(m);
  if (!b) {
    const op = m.userData?.outlineParameters, on = op && op.visible !== false && m.userData.inner !== false;
    b = on ? new THREE.MeshBasicMaterial({ color: new THREE.Color(...op.color), side: m.side })
           : new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0, blending: THREE.NoBlending, side: m.side });   // 直接写 (0,0,0,0)：挡住后面的线
    K.lm.set(m, b);
  }
  return b;
}
function inner(g, scene, camera) {
  if (scene.userData.inner === false) return;
  const { r, c } = renderer(), K = innerKit(), sw = [], hid = [], prevBg = scene.background;
  scene.background = null;
  scene.traverse(o => {
    if (!o.visible) return;
    if (o.userData.bg) { o.visible = false; hid.push(o); return; }
    if (o.isMesh && !Array.isArray(o.material)) { sw.push([o, o.material]); }
  });
  const shadow = r.shadowMap.enabled; r.shadowMap.enabled = false;
  r.setRenderTarget(K.tn); r.setClearColor(0x8080ff, 1); r.clear(); scene.overrideMaterial = K.nrm; r.render(scene, camera); scene.overrideMaterial = null;
  for (const [o, m] of sw) o.material = lineMat(m);
  r.setRenderTarget(K.tl); r.setClearColor(0x000000, 0); r.clear(); r.render(scene, camera);
  for (const [o, m] of sw) o.material = m;
  for (const o of hid) o.visible = true;
  scene.background = prevBg; r.shadowMap.enabled = shadow;
  const U = K.quad.material.uniforms, io = { ...INNER, ...(scene.userData.innerOpt || {}) };
  U.tN.value = K.tn.texture; U.tD.value = K.tn.depthTexture; U.tL.value = K.tl.texture;
  U.near.value = camera.near; U.far.value = camera.far; U.ortho.value = camera.isOrthographicCamera ? 1 : 0;
  U.dz.value = io.dz; U.dzk.value = io.dzk; U.dn.value = io.dn;
  r.setRenderTarget(null); r.setClearColor(0x000000, 0); r.clear(); r.render(K.qs, K.qc);
  g.drawImage(c, 0, 0);
}

// 渲一帧：颜色层贴整张渲染结果（+ 内部线）；发光层只印前景物件的黑色剪影（userData.bg = true 的台面、收影平面不印）
export function draw3d(g, e, scene, camera) {
  const { r, c, fx, sil } = renderer();
  r.setRenderTarget(null); r.clear();
  fx.render(scene, camera);
  g.drawImage(c, 0, 0);
  inner(g, scene, camera);
  if (!e) return;
  const hid = []; scene.traverse(o => { if (o.userData.bg && o.visible) { o.visible = false; hid.push(o); } });
  scene.overrideMaterial = sil; r.clear(); r.render(scene, camera); scene.overrideMaterial = null;
  for (const o of hid) o.visible = true;
  e.drawImage(c, 0, 0);
}
