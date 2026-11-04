// lib3d.js —— 三渲二管线：three 渲到离屏 canvas → g.drawImage 进颜色层；发光层 e 上印三维物件的黑色剪影（挡光）。之后照常走 CRT 后期。
// 卡通材质：MeshToonMaterial + 硬边 RGB 渐变贴图 [暗阶, 亮阶, 高光阶]：暗阶 = 影色 / 亮色、高光阶 = 高光 / 亮色（逐通道比值），
//   亮阶 = 1 → 受光面正好是色指定 lit，背光面和落在它身上的投影正好是 sh（三维只决定「哪里亮、哪里暗」，颜色全由色指定给）。
// 场景里只放一盏白色方向光（强度 1）、不放环境光：暗部不会被提平。落影系数取 .5 做阈值 → 投影也是硬边。
// 描边：OutlineEffect（背面外扩），每个材质用自己的描边色（pal.js 的 line，彩色描边，不用纯黑）。
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

// 渲一帧：颜色层贴整张渲染结果；发光层只印前景物件的黑色剪影（userData.bg = true 的台面、收影平面不印）
export function draw3d(g, e, scene, camera) {
  const { r, c, fx, sil } = renderer();
  r.setRenderTarget(null); r.clear();
  fx.render(scene, camera);
  g.drawImage(c, 0, 0);
  if (!e) return;
  const hid = []; scene.traverse(o => { if (o.userData.bg && o.visible) { o.visible = false; hid.push(o); } });
  scene.overrideMaterial = sil; r.clear(); r.render(scene, camera); scene.overrideMaterial = null;
  for (const o of hid) o.visible = true;
  e.drawImage(c, 0, 0);
}
