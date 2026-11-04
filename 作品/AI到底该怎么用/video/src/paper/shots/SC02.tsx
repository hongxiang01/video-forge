import React from 'react';
import {AbsoluteFill} from 'remotion';
import {P, Svg, Floor, Belt, Arm, Clock, Keyword, Callout, at, blk, prog, lerp, easeInOut, clamp01, useF} from '../kit';
import {CamK, CamKey} from './SC03';

// SC02：S04–S07 为什么是 10:10。
// S04 "为什么偏偏是十点十分？"：承接 SC01 末的取景（(800,560) 1.3 倍），继续推近那只 10:10 表直到它填满画面中央 → 手绘大问号。
// S05 "翻开手表广告，|指针几乎都摆在这个位置"：3×3 手表广告海报逐个弹出；第 2 块时九只表的指针依次变橙红。
// S06 "两根指针对称张开，|像一张笑脸，|也不挡品牌的标志"：回到大钟：指针延长线画出 V → 橙红笑脸弧 → 12 点下 logo 横条 + 标注。
// S07 "AI 看过的表，|几乎都长这样"：海报缩小排上传送带，相机跟着往右流进机械臂上方的料斗；关键词"几乎都长这样"。

// 海报网格（3×3）
const PW = 300;
const PH = 250;
const GAP = 26;
const GX0 = 960 - (3 * PW + 2 * GAP) / 2;
const GY0 = 128;
const gridPos = (i: number) => ({x: GX0 + (i % 3) * (PW + GAP), y: GY0 + Math.floor(i / 3) * (PH + GAP)});

// S07 传送带 / 料斗
const BELT_Y = 300;
const SMALL = 0.36;
const MOUTH_X = 880; // 海报左缘到这里就掉进料斗
const slotX = (i: number) => 760 - i * 125;

// 大钟（S04 推近后的落点 = 画面中心）
const BIG = {cx: 960, cy: 540};
const CLOCK0 = {cx: 760, cy: 630, r: 52}; // SC01 里那只表

/** 手表广告海报（无真实品牌：品牌横条占位） */
const Poster: React.FC<{x: number; y: number; s?: number; hot?: boolean; opacity?: number}> = ({x, y, s = 1, hot, opacity = 1}) => (
  <g transform={`translate(${x} ${y}) scale(${s})`} opacity={opacity}>
    <rect x={8} y={8} width={PW} height={PH} rx={10} fill={P.soft} />
    <rect x={0} y={0} width={PW} height={PH} rx={10} fill={P.white} stroke={P.ink} strokeWidth={4} />
    <Clock cx={PW / 2} cy={104} r={76} h={10} m={10} hot={hot} box={false} />
    <rect x={PW / 2 - 14} y={104 - 50} width={28} height={8} rx={2} fill={P.mid} />
    <rect x={PW / 2 - 76} y={198} width={152} height={16} rx={4} fill={P.ink} />
    <rect x={PW / 2 - 44} y={222} width={88} height={9} rx={3} fill={P.mid} />
  </g>
);

export const SC02: React.FC = () => {
  const f = useF();
  const s4 = at('S04');
  const s5 = at('S05');
  const s6 = at('S06');
  const s7 = at('S07');
  const handsHot = blk('S05', 1);
  const smile = blk('S06', 1);
  const logo = blk('S06', 2);
  const kw = blk('S07', 1);

  // S04：从 SC01 末取景继续推近那只表（世界坐标 = SC01）
  const w0 = s4.from - 12;
  const push = easeInOut((f - w0) / 28);
  const pS = lerp(1.3, (150 / CLOCK0.r) * 1.0, push);
  const pCx = lerp(800, CLOCK0.cx, push);
  const pCy = lerp(560, CLOCK0.cy, push);
  const hand = prog(f, w0 + 22, 8); // 交接：流水线场景 → 画面中心大钟
  const lineOp = 1 - hand;

  // 大钟：S05 起缩小淡出；S06 回来（更大）；S07 淡出
  const bigOut5 = prog(f, s5.from - 2, 10);
  const bigIn6 = prog(f, s6.from - 4, 14);
  const bigOut7 = prog(f, s7.from - 2, 10);
  const inS6 = f >= s6.from - 4;
  const bigOp = inS6 ? bigIn6 * (1 - bigOut7) : hand * (1 - bigOut5);
  const bigScale = inS6 ? lerp(0.85, 1, bigIn6) : lerp(1, 0.5, bigOut5);
  const bigR = inS6 ? 190 : 150;

  // 问号（S04 内画出，S05 淡出）
  const qDraw = prog(f, s4.from + 10, 18);
  const qOp = 1 - prog(f, s5.from - 2, 8);

  // 海报墙
  const wallDim = inS6 && f < s7.from ? lerp(1, 0.12, prog(f, s6.from - 4, 12)) : 1;
  const shrink = easeInOut((f - (s7.from - 2)) / 24);
  const run = Math.max(0, f - (s7.from + 22)) * 7;

  // S06 V 线
  const vDraw = prog(f, s6.from + 8, 20);
  const smileDraw = prog(f, smile, 14);
  const logoP = prog(f, logo, 10);
  const mRad = ((60 - 90) * Math.PI) / 180;
  const hRad = ((305 - 90) * Math.PI) / 180;
  const vLen = bigR * 1.6;
  const logoY = BIG.cy - bigR * 0.72;

  const s7In = prog(f, s7.from, 14);

  // 相机（推近交接完成后）：S04–S06 慢推 1.0→1.08；S07 横移跟着海报往右流进料斗
  const cam: CamKey[] = [
    [w0 + 30, 1, 960, 540],
    [s4.to, 1.06, 960, 540],
    [s5.from + 4, 1.0, 960, 540],
    [s5.to, 1.08, 960, 540],
    [s6.from + 4, 1.0, 960, 540],
    [s6.to, 1.06, 960, 540],
    [s7.to + 30, 1.1, 1060, 560],
  ];

  return (
    <AbsoluteFill>
      {/* S04 推近：沿用 SC01 的世界坐标与取景 */}
      {lineOp > 0 ? (
        <div style={{position: 'absolute', inset: 0, opacity: lineOp, transform: `translate(${960 - pCx * pS}px, ${540 - pCy * pS}px) scale(${pS})`, transformOrigin: '0 0'}}>
          <Svg>
            <Floor />
            <Belt phase={f} />
            <Clock cx={240} cy={630} h={10} m={10} opacity={0.9} />
            <Clock cx={460} cy={630} h={10} m={10} opacity={0.9} />
            <Clock cx={CLOCK0.cx} cy={CLOCK0.cy} r={52} h={10} m={10} hot />
            <Arm bx={760} tx={760} ty={560} open={0.2} />
          </Svg>
        </div>
      ) : null}

      <CamK keys={cam}>
        <Svg>
          {/* 海报墙：S05 弹出，S06 退为背景，S07 缩小上传送带并流进料斗 */}
          {f >= s5.from - 2
            ? Array.from({length: 9}).map((_, i) => {
                const pop = prog(f, s5.from + i * 4, 10);
                if (pop <= 0) return null;
                const g = gridPos(i);
                const tx = slotX(i) + run;
                const fallT = clamp01((tx - MOUTH_X) / 40);
                if (fallT >= 1) return null;
                const sx = Math.min(tx, MOUTH_X + 40);
                const sy = BELT_Y - PH * SMALL + 300 * fallT * fallT;
                const x = lerp(g.x, sx, shrink);
                const y = lerp(g.y, sy, shrink);
                const s = lerp(0.6 + 0.4 * pop, SMALL, shrink);
                const cx = x + ((PW * (1 - s)) / 2) * (1 - shrink);
                const cy = y + ((PH * (1 - s)) / 2) * (1 - shrink);
                return <Poster key={i} x={cx} y={cy} s={s} hot={f >= handsHot + i * 2 && !(inS6 && f < s7.from)} opacity={pop * wallDim} />;
              })
            : null}

          {/* S07：传送带 + 料斗 + 机械臂 */}
          {f >= s7.from - 2 ? (
            <g opacity={s7In}>
              <Belt x0={-300} x1={920} y={BELT_Y} floor={BELT_Y + 44} phase={f * 3.5} />
              <path d="M 860 320 L 1240 320 L 1096 520 L 1000 520 Z" fill={P.soft} stroke={P.ink} strokeWidth={4} strokeLinejoin="round" />
              <line x1={892} y1={364} x2={1208} y2={364} stroke={P.mid} strokeWidth={3} />
              <rect x={1022} y={520} width={52} height={52} fill={P.soft} stroke={P.ink} strokeWidth={4} />
              <Arm bx={1048} tx={1048} ty={870} railY={580} railX0={560} railX1={1560} open={0.3} />
            </g>
          ) : null}

          {/* 大钟 */}
          {bigOp > 0 ? (
            <g opacity={bigOp} transform={`translate(${BIG.cx} ${BIG.cy}) scale(${bigScale}) translate(${-BIG.cx} ${-BIG.cy})`}>
              <Clock cx={BIG.cx} cy={BIG.cy} r={bigR} h={10} m={10} hot={!inS6} />
              {inS6 ? (
                <g>
                  {[mRad, hRad].map((a, k) => (
                    <line key={k} x1={BIG.cx} y1={BIG.cy} x2={BIG.cx + Math.cos(a) * vLen * vDraw} y2={BIG.cy + Math.sin(a) * vLen * vDraw} stroke={P.ink} strokeWidth={6} strokeDasharray="18 13" strokeLinecap="round" />
                  ))}
                  <path
                    d={`M ${BIG.cx - 112} ${BIG.cy + 66} Q ${BIG.cx} ${BIG.cy + 168} ${BIG.cx + 112} ${BIG.cy + 66}`}
                    fill="none"
                    stroke={P.accent}
                    strokeWidth={12}
                    strokeLinecap="round"
                    strokeDasharray={300}
                    strokeDashoffset={300 * (1 - smileDraw)}
                  />
                  <rect x={BIG.cx - 50} y={logoY - 12} width={100} height={24} rx={5} fill={P.ink} opacity={logoP} transform={`translate(0 ${(1 - logoP) * -10})`} />
                </g>
              ) : null}
            </g>
          ) : null}

          {/* 大问号（墨线手绘） */}
          {qDraw > 0 && qOp > 0 ? (
            <g opacity={qOp}>
              <path
                d="M 1222 310 C 1218 240 1330 228 1336 298 C 1340 346 1282 352 1280 400 L 1280 428"
                fill="none"
                stroke={P.ink}
                strokeWidth={16}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={420}
                strokeDashoffset={420 * (1 - qDraw)}
              />
              <circle cx={1281} cy={472} r={11 * prog(f, s4.from + 26, 6)} fill={P.ink} />
            </g>
          ) : null}
        </Svg>
        {inS6 && f >= logo + 6 && bigOut7 < 1 ? (
          <AbsoluteFill style={{opacity: 1 - bigOut7}}>
            <Callout x={BIG.cx + 50} y={logoY} ex={1260} ey={logoY - 150} len={210} label="不挡 logo" start={logo + 6} size={48} />
          </AbsoluteFill>
        ) : null}
        {f >= kw - 4 ? <Keyword text="几乎都长这样" cx={520} cy={760} start={kw - 4} size={96} circle={false} /> : null}
      </CamK>
    </AbsoluteFill>
  );
};
