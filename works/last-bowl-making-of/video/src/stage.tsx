// 发布会大屏：深色舞台 + 大屏 + 关键词 + 橙色圈（风格卡见 ../script.md「风格卡」）
import React from 'react';
import {AbsoluteFill, Easing, interpolate, useCurrentFrame} from 'remotion';

export const C = {
  bg0: '#0B0C10', bg1: '#23262F', bezel: '#1C1E25', edge: '#3A3D48',
  text: '#F4EFE6', dim: '#9AA0AE', accent: '#F2A54A',  // 强调色 = 片子里吊灯的暖橙
};
export const FONT = '"PingFang SC", "Hiragino Sans GB", sans-serif';
const ease = Easing.out(Easing.cubic);

export const Stage: React.FC<{children?: React.ReactNode}> = ({children}) => (
  <AbsoluteFill style={{background: `radial-gradient(ellipse 70% 60% at 50% 18%, ${C.bg1} 0%, ${C.bg0} 72%)`}}>
    {/* 顶灯两道很淡的光 */}
    <AbsoluteFill style={{background: 'linear-gradient(100deg, transparent 30%, rgba(255,255,255,0.025) 38%, transparent 46%), linear-gradient(80deg, transparent 54%, rgba(255,255,255,0.025) 62%, transparent 70%)'}} />
    {/* 地面暖橙反光 */}
    <div style={{position: 'absolute', left: 260, right: 260, top: 900, height: 220, borderRadius: '50%',
      background: `radial-gradient(ellipse at 50% 0%, rgba(242,165,74,0.20), rgba(242,165,74,0) 70%)`}} />
    {children}
  </AbsoluteFill>
);

/** 屏幕框：x、y、w 为舞台坐标，16:9 */
export const Screen: React.FC<{x: number; y: number; w: number; appear?: number; children?: React.ReactNode}> = ({x, y, w, appear = 0, children}) => {
  const f = useCurrentFrame();
  const t = interpolate(f, [appear, appear + 12], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: ease});
  const h = (w * 9) / 16;
  return (
    <div style={{position: 'absolute', left: x, top: y, width: w, height: h, opacity: t, transform: `scale(${0.97 + 0.03 * t})`,
      borderRadius: 16, overflow: 'hidden', background: '#000',
      boxShadow: `0 0 0 6px ${C.bezel}, 0 0 0 7px ${C.edge}, 0 30px 120px rgba(242,165,74,0.18)`}}>
      {children}
    </div>
  );
};

/** 关键词：每屏最多一个，屏幕下方居中，橙色短横线压底 */
export const Keyword: React.FC<{text: string; y?: number; appear: number; size?: number}> = ({text, y = 880, appear, size = 64}) => {
  const f = useCurrentFrame();
  const t = interpolate(f, [appear, appear + 10], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: ease});
  return (
    <div style={{position: 'absolute', left: 0, right: 0, top: y, textAlign: 'center', opacity: t, transform: `translateY(${(1 - t) * 18}px)`}}>
      <div style={{fontFamily: FONT, fontWeight: 700, fontSize: size, color: C.text, letterSpacing: 4}}>{text}</div>
      <div style={{margin: '18px auto 0', width: 120 * t, height: 6, borderRadius: 3, background: C.accent}} />
    </div>
  );
};

/** 屏幕上方的小标签（如「第一版」「第六版」） */
export const Label: React.FC<{text: string; x: number; y: number; w: number; hi?: boolean; appear: number}> = ({text, x, y, w, hi, appear}) => {
  const f = useCurrentFrame();
  const t = interpolate(f, [appear, appear + 10], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: ease});
  return (
    <div style={{position: 'absolute', left: x, top: y, width: w, textAlign: 'center', opacity: t,
      fontFamily: FONT, fontWeight: 600, fontSize: 36, letterSpacing: 6, color: hi ? C.accent : C.dim}}>{text}</div>
  );
};

/** 橙色圈：一笔画出（12 帧），舞台坐标的椭圆 */
export const Callout: React.FC<{cx: number; cy: number; rx: number; ry: number; appear: number}> = ({cx, cy, rx, ry, appear}) => {
  const f = useCurrentFrame();
  const p = interpolate(f, [appear, appear + 12], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: ease});
  const len = Math.PI * (3 * (rx + ry) - Math.sqrt((3 * rx + ry) * (rx + 3 * ry)));
  return (
    <svg style={{position: 'absolute', left: 0, top: 0}} width={1920} height={1080}>
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="none" stroke={C.accent} strokeWidth={8} strokeLinecap="round"
        strokeDasharray={len} strokeDashoffset={len * (1 - p * 1.04)} transform={`rotate(-4 ${cx} ${cy})`} />
    </svg>
  );
};

/** 段落间交叉淡化 */
export const Fade: React.FC<{dur: number; children: React.ReactNode}> = ({dur, children}) => {
  const f = useCurrentFrame();
  const o = interpolate(f, [0, 8, dur - 8, dur], [0, 1, 1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return <AbsoluteFill style={{opacity: o}}>{children}</AbsoluteFill>;
};
