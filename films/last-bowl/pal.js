// 色指定（TREATMENT §4.3）。光照：warm = 暖灯；in = 灯灭·光斑内；out = 灯灭·光斑外。
// C(name, light) → { f: lit, s: shadow, l: line, h: 高光（lit 向该光照的光色混 25%） }
import { mix } from './lib/cel.js';

export const LIGHT = { warm: '#FFE6B8', in: '#C8D0F0', out: '#6A70A8' };

// 每个物件：[暖灯 lit, sh, line] 和 [灯灭 光斑内 lit, 光斑外 lit, sh, line]（null = 这一光照下不出现）
const T = {
  skin:     [['#D9A07A', '#9C6250', '#4A2A1E'], ['#875E5F', '#4E323A', '#341B23', '#221113']],
  callus:   [['#E6BA8F', '#AB7662', '#4A2A1E'], ['#8F6D6E', '#533A44', '#39202B', '#221113']],
  sleeve:   [['#E8DCC0', '#8C749B', '#63554D'], ['#8589A6', '#46496D', '#28274A', '#211E32']],
  cuff:     [['#C8B07A', '#7A5C56', '#63554D'], ['#736E6A', '#3C3B46', '#221F29', '#211E32']],
  apron:    [['#9A9C99', '#534A6C', '#383540'], ['#596184', '#2E3457', '#171933', '#13122A']],
  flour:    [['#F4EBD8', '#9C83AB', '#978380'], ['#8C93BB', '#494E7B', '#2C2C52', '#322E53']],
  dough:    [['#EEDDB9', '#977886', '#7E634E'], ['#898AA0', '#474A69', '#2B2840', '#2A2333']],
  basin:    [['#C4C0B4', '#695C7E', '#434048'], ['#71789B', '#3B4066', '#1D1F3C', '#16162F']],
  pin:      [['#D29F64', '#754534', '#512E1A'], ['#796457', '#3F3539', '#211719', '#1B1011']],
  knife:    [['#A8A7A0', '#4E4661', '#29282E'], null],
  pot:      [['#8E8E88', '#423B52', '#26252A'], null],
  bowl:     [['#F2E8D1', '#937CA8', '#7E707B'], ['#8B91B5', '#494D77', '#292950', '#2A2750']],
  rim:      [['#C8323A', '#6C1423', '#510D13'], ['#731F32', '#3C1121', '#1E0711', '#1B040C']],   // 点缀色：全片唯一
  shade:    [['#4E6A51', '#242D2F', '#171E1A'], ['#2D4246', '#17232E', '#0A0F16', '#080B11']],   // 灯罩外（墨绿搪瓷）
  cord:     [['#D8C49B', '#7A5F65', '#514033'], ['#7C7A86', '#414158', '#222030', '#1B1621']],
  cloth:    [['#B8AD94', '#62515E', '#433832'], ['#6A6C80', '#373A54', '#1C1B2D', '#161420']],
  guestSkin:[['#CDAB94', '#8B6364', '#432A35'], null],
  frostbite:[['#D8847B', '#974D53', '#432A35'], null],
  coat:     [['#343D5D', '#1B1C3C', '#141626'], null],
};
export const SKIN_HI = '#E3B28A';   // 师傅皮肤高光（暖灯）
export const CORE = '#FFF4DC';      // 灯罩内发光（暖灯时进发光板）

export function C(name, light = 'warm') {
  const row = T[name]; if (!row) throw new Error('pal: 没有物件 ' + name);
  if (light === 'warm') { const [f, s, l] = row[0]; return { f, s, l, h: mix(f, LIGHT.warm, .25) }; }
  if (!row[1]) throw new Error(`pal: ${name} 在灯灭时不出现`);
  const [fin, fout, s, l] = row[1], f = light === 'in' ? fin : fout;
  return { f, s, l, h: mix(f, LIGHT[light], .25) };
}

// 逆光剪影套（不乘，直接给）
export const SIL = {
  s5:  { skin: '#5A3A40', sleeve: '#6E6070', line: '#2A1A1E', rim: '#FFD9A0' },   // S5 举面片的手（暖）
  s13: { skin: '#4A3A5C', sleeve: '#5E5876', line: '#2A1A24', rim: '#FFD27A' },   // S13 窗外的手（冷）
};
export const SNOWLIGHT_RIM = '#9CC8FF';   // S3 窗外冷光轮廓

// 背景板关键色（不走乘法，按光照各画一张）
export const BG = {
  warm: { wood: '#7A4A2A', woodHalo: '#A86E3C', woodDark: '#4A3550', grain: '#3A2418', wallNear: '#CBB08A', wallFar: '#5A4458', glassTint: '#F2B25C' },
  dark: { woodIn: '#6A6488', woodOut: '#3A3460', woodDark: '#1E1A3A', grain: '#121028', wallNear: '#4A4E78', wallFar: '#22223E' },
  night: { indigo: '#1E2450', snowGrey: '#8C93B8', lampGold: '#FFD27A' },
};
// 窗外雪（附 3）
export const SNOW = { far: '#8C93B8', mid: '#C8CEE8', near: '#E6EAF8', lampSnow: '#FFE6A8' };
// 字幕 / 片名（§8）
export const TYPE = { sub: '#FFF0B8', subLine: '#2A1A24', chrome: ['#8FD3FF', '#FFFFFF', '#7A5BC8', '#F28AB0', '#FFD27A'], titleLine: '#121028', neon: '#F2B25C' };
