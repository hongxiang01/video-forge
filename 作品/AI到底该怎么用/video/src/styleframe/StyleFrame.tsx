import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {Fonts, FONT_HEAVY} from '../common/lib';

// 风格帧：同一镜头（流水线工位 + 吊轨机械臂 + 10:10 钟 + 检测门 + 验收剪影），三套配色对比。
// 动效语法借 video-talkcraft：hand-drawn-ellipse（手绘圈）、callout-line-label（标注引出线）。

export type Palette = {
  name: string;
  bg: string; // 底色
  soft: string; // 大面积次要色块
  mid: string; // 次要线条 / 远景
  ink: string; // 主线条与文字
  accent: string; // 唯一强调色
  grid?: string; // 蓝图网格
  hazard?: boolean; // 工业警示斜纹
};

export const PALETTES: Record<string, Palette> = {
  A: {name: '纸本', bg: '#F2ECE0', soft: '#E4D9C4', mid: '#9A8F7E', ink: '#1F1B16', accent: '#E2552B'},
  B: {name: '蓝图', bg: '#0F2238', soft: '#16304D', mid: '#5E7895', ink: '#EDE5D3', accent: '#F2A93B', grid: 'rgba(237,229,211,.07)'},
  C: {name: '工业', bg: '#D9DBD5', soft: '#C6CAC2', mid: '#7D8A83', ink: '#1E3A32', accent: '#F2C230', hazard: true},
};

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const easeOut = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);

// 钟：圆盘 + 刻度 + 时针/分针（h, m）
const Clock: React.FC<{cx: number; cy: number; r: number; p: Palette; h: number; m: number; hot?: boolean}> = ({cx, cy, r, p, h, m, hot}) => {
  const mA = (m / 60) * 360;
  const hA = ((h % 12) / 12) * 360 + (m / 60) * 30;
  const hand = (a: number, len: number, w: number, c: string) => {
    const rad = ((a - 90) * Math.PI) / 180;
    return <line x1={cx} y1={cy} x2={cx + Math.cos(rad) * len} y2={cy + Math.sin(rad) * len} stroke={c} strokeWidth={w} strokeLinecap="round" />;
  };
  return (
    <g>
      <rect x={cx - r - 14} y={cy - r - 14} width={(r + 14) * 2} height={(r + 14) * 2} rx={10} fill={p.soft} stroke={p.ink} strokeWidth={4} />
      <circle cx={cx} cy={cy} r={r} fill={p.bg} stroke={p.ink} strokeWidth={4} />
      {Array.from({length: 12}).map((_, i) => {
        const a = (i / 12) * Math.PI * 2;
        const r1 = r - (i % 3 === 0 ? 13 : 8);
        return <line key={i} x1={cx + Math.cos(a) * r1} y1={cy + Math.sin(a) * r1} x2={cx + Math.cos(a) * (r - 3)} y2={cy + Math.sin(a) * (r - 3)} stroke={p.ink} strokeWidth={i % 3 === 0 ? 4 : 2} />;
      })}
      {hand(hA, r * 0.5, 7, hot ? p.accent : p.ink)}
      {hand(mA, r * 0.78, 5, hot ? p.accent : p.ink)}
      <circle cx={cx} cy={cy} r={6} fill={p.ink} />
    </g>
  );
};

// 验收剪影：远、小、静止（人物不演戏）
const Inspector: React.FC<{x: number; floor: number; p: Palette}> = ({x, floor, p}) => (
  <g fill={p.ink}>
    <circle cx={x} cy={floor - 232} r={26} />
    <path d={`M ${x - 40} ${floor - 196} Q ${x} ${floor - 214} ${x + 40} ${floor - 196} L ${x + 34} ${floor - 92} L ${x - 34} ${floor - 92} Z`} />
    <rect x={x - 30} y={floor - 96} width={24} height={96} rx={8} />
    <rect x={x + 6} y={floor - 96} width={24} height={96} rx={8} />
    {/* 手里的验收板 */}
    <rect x={x - 82} y={floor - 178} width={46} height={60} rx={4} fill={p.bg} stroke={p.ink} strokeWidth={4} transform={`rotate(-12 ${x - 59} ${floor - 148})`} />
    <path d={`M ${x - 70} ${floor - 150} l 9 9 l 16 -20`} stroke={p.accent} strokeWidth={5} fill="none" strokeLinecap="round" strokeLinejoin="round" transform={`rotate(-12 ${x - 59} ${floor - 148})`} />
  </g>
);

// 手绘歪椭圆（一笔逆时针 1.08 圈，尾巴过头与起笔交叉）
const ellipsePath = (cx: number, cy: number, rx: number, ry: number) => {
  const pts: string[] = [];
  const N = 90;
  const tilt = (-3.5 * Math.PI) / 180;
  for (let i = 0; i <= N; i++) {
    const t = Math.PI * 0.85 - (i / N) * Math.PI * 2 * 1.08;
    const wob = 1 + 0.035 * Math.sin(3 * t + 0.7) + 0.02 * Math.sin(5 * t);
    const x0 = Math.cos(t) * rx * wob;
    const y0 = Math.sin(t) * ry * wob;
    const x = cx + x0 * Math.cos(tilt) - y0 * Math.sin(tilt);
    const y = cy + x0 * Math.sin(tilt) + y0 * Math.cos(tilt);
    pts.push(`${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`);
  }
  return pts.join(' ');
};

export const StyleFrame: React.FC<{pal: keyof typeof PALETTES}> = ({pal}) => {
  const p = PALETTES[pal];
  const f = useCurrentFrame();
  const FLOOR = 900;
  const BELT_Y = 700;
  const belt = (f * 2) % 60; // 传送带滚动相位
  const draw = easeOut((f - 20) / 15); // 手绘圈 0.5s
  const punch = f > 36 ? 1 + 0.06 * (1 - easeOut((f - 36) / 7)) : 1;
  const callout = easeOut((f - 50) / 12);
  const E_LEN = 1500;

  return (
    <AbsoluteFill style={{background: p.bg}}>
      <Fonts />
      <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{position: 'absolute', inset: 0}}>
        {/* 蓝图网格 */}
        {p.grid
          ? Array.from({length: 49}).map((_, i) => <line key={'v' + i} x1={i * 40} y1={0} x2={i * 40} y2={1080} stroke={p.grid} strokeWidth={i % 5 === 0 ? 2 : 1} />)
          : null}
        {p.grid
          ? Array.from({length: 28}).map((_, i) => <line key={'h' + i} x1={0} y1={i * 40} x2={1920} y2={i * 40} stroke={p.grid} strokeWidth={i % 5 === 0 ? 2 : 1} />)
          : null}

        {/* 远景：厂房窗格 */}
        {Array.from({length: 6}).map((_, i) => (
          <rect key={i} x={140 + i * 290} y={200} width={220} height={130} fill="none" stroke={p.mid} strokeWidth={3} opacity={0.55} />
        ))}
        {Array.from({length: 6}).map((_, i) => (
          <line key={'m' + i} x1={250 + i * 290} y1={200} x2={250 + i * 290} y2={330} stroke={p.mid} strokeWidth={2} opacity={0.55} />
        ))}

        {/* 地面 */}
        <rect x={0} y={FLOOR} width={1920} height={180} fill={p.soft} />
        <line x1={0} y1={FLOOR} x2={1920} y2={FLOOR} stroke={p.ink} strokeWidth={4} />

        {/* 吊轨 */}
        <rect x={80} y={120} width={1240} height={26} fill={p.soft} stroke={p.ink} strokeWidth={4} />
        {Array.from({length: 8}).map((_, i) => (
          <line key={i} x1={120 + i * 170} y1={60} x2={120 + i * 170} y2={120} stroke={p.ink} strokeWidth={4} />
        ))}

        {/* 传送带 */}
        <rect x={60} y={BELT_Y} width={1500} height={44} rx={22} fill={p.soft} stroke={p.ink} strokeWidth={4} />
        {Array.from({length: 26}).map((_, i) => {
          const x = 80 + ((i * 60 + belt) % 1500);
          if (x > 1535) return null;
          return <line key={i} x1={x} y1={BELT_Y + 6} x2={x} y2={BELT_Y + 38} stroke={p.mid} strokeWidth={3} />;
        })}
        {Array.from({length: 11}).map((_, i) => (
          <g key={i}>
            <line x1={150 + i * 135} y1={BELT_Y + 44} x2={150 + i * 135} y2={FLOOR} stroke={p.ink} strokeWidth={4} />
          </g>
        ))}

        {/* 带上的钟：全部 10:10 */}
        <Clock cx={220} cy={BELT_Y - 70} r={52} p={p} h={10} m={10} />
        <Clock cx={440} cy={BELT_Y - 70} r={52} p={p} h={10} m={10} />
        <Clock cx={1050} cy={BELT_Y - 70} r={52} p={p} h={10} m={10} hot />

        {/* 吊轨机械臂：小车 → 上臂 → 前臂 → 夹爪，夹着一个钟 */}
        <g>
          <rect x={690} y={110} width={140} height={46} rx={8} fill={p.ink} />
          <line x1={760} y1={156} x2={720} y2={330} stroke={p.ink} strokeWidth={26} strokeLinecap="round" />
          <circle cx={720} cy={330} r={22} fill={p.bg} stroke={p.ink} strokeWidth={6} />
          <line x1={720} y1={330} x2={780} y2={470} stroke={p.ink} strokeWidth={20} strokeLinecap="round" />
          <circle cx={780} cy={470} r={16} fill={p.bg} stroke={p.ink} strokeWidth={6} />
          <path d="M 745 490 L 745 520 M 815 490 L 815 520 M 745 490 L 815 490" stroke={p.ink} strokeWidth={10} fill="none" strokeLinecap="round" />
          <Clock cx={780} cy={588} r={52} p={p} h={10} m={10} />
        </g>

        {/* 检测门（防错法） */}
        <g>
          <rect x={1300} y={520} width={30} height={180} fill={p.ink} />
          <rect x={1470} y={520} width={30} height={180} fill={p.ink} />
          <rect x={1290} y={500} width={220} height={30} fill={p.hazard ? p.accent : p.ink} stroke={p.ink} strokeWidth={4} />
          {p.hazard
            ? Array.from({length: 8}).map((_, i) => <path key={i} d={`M ${1296 + i * 28} 528 l 14 -26 l 10 0 l -14 26 Z`} fill={p.ink} />)
            : null}
          <line x1={1330} y1={620} x2={1470} y2={620} stroke={p.accent} strokeWidth={5} strokeDasharray="14 10" />
          <circle cx={1485} cy={510} r={9} fill={p.accent} />
        </g>

        {/* 验收剪影 */}
        <Inspector x={1720} floor={FLOOR} p={p} />

        {/* 标注引出线：从热点钟拉出 → 标签 10:10 */}
        <g opacity={callout > 0 ? 1 : 0}>
          <circle cx={1050} cy={BELT_Y - 70} r={10 + 30 * callout} fill="none" stroke={p.accent} strokeWidth={3} opacity={1 - callout} />
          <path d={`M 1050 ${BELT_Y - 70} L 1110 ${BELT_Y - 250} L ${1110 + 150 * callout} ${BELT_Y - 250}`} stroke={p.accent} strokeWidth={4} fill="none" strokeLinecap="round" strokeDasharray={400} strokeDashoffset={400 * (1 - callout)} />
          <circle cx={1050} cy={BELT_Y - 70} r={8} fill={p.accent} />
        </g>
      </svg>

      {/* 标签文字 */}
      <div style={{position: 'absolute', left: 1112, top: BELT_Y - 312, fontFamily: FONT_HEAVY, fontWeight: 800, fontSize: 46, color: p.ink, opacity: callout, letterSpacing: 1, fontVariantNumeric: 'tabular-nums'}}>
        永远 10:10
      </div>

      {/* 主关键词 + 手绘圈 */}
      <div style={{position: 'absolute', left: 150, top: 400, transform: `scale(${punch})`, transformOrigin: '50% 55%', fontFamily: FONT_HEAVY, fontWeight: 900, fontSize: 96, color: p.ink, letterSpacing: -1, lineHeight: 1}}>
        平均答案
      </div>
      <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{position: 'absolute', inset: 0}}>
        <path d={ellipsePath(342, 450, 245, 82)} fill="none" stroke={p.accent} strokeWidth={6} strokeLinecap="round" strokeDasharray={E_LEN} strokeDashoffset={E_LEN * (1 - draw)} />
      </svg>
    </AbsoluteFill>
  );
};
