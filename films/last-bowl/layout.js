// 主构图 A / A'（S1、S13）的世界坐标与 world→screen（TREATMENT §4.1）。所有跟随物体的效果都过这一个函数。
// 单位：米。x 向右，y 向上（屋内地面 0，街面 −0.75），z 从机位往里。机位 (0, 2.30, 0)，俯 40°，f = 1125 px，主点 (960, 540)。
const TILT = 40 * Math.PI / 180, CY = 2.30, F = 1125;
export function w2s(x, y, z) {
  const dy = y - CY, c = Math.cos(TILT), s = Math.sin(TILT);
  const yc = dy * c + z * s, zc = -dy * s + z * c;
  return [960 + F * x / zc, 540 - F * yc / zc];
}
export const scale = (x, y, z) => F / ((CY - y) * Math.sin(TILT) + z * Math.cos(TILT));   // 该处 1 米 ≈ 多少 px

export const WIN = { x0: -0.80, x1: 0.80, y0: 1.10, y1: 1.85, z: 1.50, mullions: [-0.27, 0.27], mullionW: 0.04 };
export const TABLE = { y: 0.85, z0: 0.80, z1: 1.50 };
export const LAMP_STREET = [1.20, 6.25, 4.50];        // 路灯（窗外 3 m 的人行道上，离街面 7 m）
export const SHADE = { c: [-0.45, 1.95, 1.05], r: 0.18 };   // 吊灯罩口
export const CORD = { top: [-0.38, 1.97, 1.05], bottomY: 1.25 };   // 灯绳，末端木珠
export const HALO = { c: [-0.45, 0.85, 1.05], r: 0.55 };   // 暖灯光圈
export const OBJ = {
  basin:   { c: [-0.95, 0.85, 1.12], d: 0.42 },             // A 正放，A' 倒扣
  pinA:    { a: [-0.15, 0.85, 1.02], b: [0.35, 0.85, 0.90] },
  pinA2:   { a: [-0.10, 0.85, 0.92], b: [0.40, 0.85, 0.92] },
  stackA:  { c: [1.05, 0.85, 0.98], h: 0.30, n: 5 },        // A：五只红沿碗摞在右台角
  bowlA2:  { c: [-0.06, 0.85, 1.305], r: 0.085, h: 0.07 },  // A'：只剩一只，正放，碗沿 y = 0.92；x 原为 −0.30（压在左窗棂影起点，像带柄奶锅），2026-11-04 挪到两道窗棂影之间
  apronA2: { c: [1.05, 0.87, 1.00] },
  wipeA2:  { a: [-0.75, 0.85, 0.88], b: [0.55, 0.85, 1.20], w: 0.06 },
};

// 卷帘门底杠高度（屋内坐标）：38.625 起 1.125 s 从 1.85 落到 1.10（窗台）
export function shutterH(t) {
  if (t < 38.625) return 1.85;
  const u = Math.min(1, (t - 38.625) / 1.125);
  return 1.85 - 0.75 * (1 - (1 - u) * (1 - u));
}
// 路灯穿窗落到台面（y = TABLE.y）的光斑：返回屏幕多边形 + 两条窗棂影；底杠高度 h 决定前沿
export function spot(h = 1.85, y = TABLE.y) {
  const [lx, ly, lz] = LAMP_STREET, d = lz - WIN.z;
  const zAt = yw => lz - (ly - y) * d / (ly - yw);         // 穿过窗墙高度 yw 的光线落在台面的 z
  const xAt = (xw, z) => lx + (xw - lx) * (lz - z) / d;    // 穿过窗墙 x = xw 的光线落在台面 z 处的 x
  const top = Math.min(h, WIN.y1); if (top <= WIN.y0) return null;
  const zf = zAt(top), zb = zAt(WIN.y0);
  const P = (xw, z) => w2s(xAt(xw, z), y, z);
  return {
    zFront: zf, zBack: zb,
    poly: [P(WIN.x0, zb), P(WIN.x1, zb), P(WIN.x1, zf), P(WIN.x0, zf)],
    mullions: WIN.mullions.map(m => [P(m, zb), P(m, zf)]),
  };
}
