import React from 'react';
import {AbsoluteFill} from 'remotion';
import {P, Svg, Floor, Belt, Arm, Clock, Card, Txt, Keyword, Callout, at, blk, prog, lerp, easeInOut, useF} from '../kit';
import {CamDiv, CamKey} from './SC15';

// SC17：S54–S57 片尾回扣 SC01（SC01 是特写 → 拉远 → 交表推近，这里同样从表盘特写开场）。
// S54 "还记得那只表吗？"：从空表盘特写拉回 SC01 全景——带子 + 空表盘 (760,630) + 机械臂滑到表盘上方 + 工单卡。
// S55 "这一次，你告诉它|四点半，|给谁看，|要什么感觉，|哪里不能错|再一项一项对过"：相机推向放大的工单，逐行填满，第 6 块逐行打勾；随后机械臂下探。
// S56 "指针停在了四点半"：相机推到表盘 2.1 倍，表盘冒出橙红 4:30 指针，大号 Callout "4:30"（全片 payoff）。
// S57 "模型决定上限，|你决定结果"：旧场景淡到 0，纸面上两行大字居中："模型决定上限"（墨色）+ Keyword "你决定结果"（带圈），停到片尾。

const ROWS = [
  {k: '指针', v: '4:30'},
  {k: '给谁看', v: '小朋友'},
  {k: '感觉', v: '安静的午后'},
  {k: '不能错', v: '指针位置'},
];

/** 行内勾（HTML 内嵌 SVG，墨色 draw-on） */
const RowCheck: React.FC<{f: number; start: number}> = ({f, start}) => {
  const p = prog(f, start, 10);
  return (
    <svg width={56} height={56} viewBox="0 0 56 56" style={{flex: 'none'}}>
      <path d="M 10 30 l 12 13 l 24 -30" stroke={P.ok} strokeWidth={8} fill="none" strokeLinecap="round" strokeLinejoin="round" strokeDasharray={70} strokeDashoffset={70 * (1 - p)} />
    </svg>
  );
};

export const SC17: React.FC = () => {
  const f = useF();
  const s54 = at('S54');
  const s55 = at('S55');
  const s56 = at('S56');
  const s57 = at('S57');
  const rowT = [blk('S55', 1), blk('S55', 2), blk('S55', 3), blk('S55', 4)];
  const checkT = blk('S55', 5);
  // 机械臂：S54 从右滑到表盘上方；S55 末下探；S56 揭晓后抬起
  const slide = easeInOut((f - (s54.from - 6)) / 30);
  const bx = lerp(1150, 760, slide);
  const down = easeInOut((f - (s55.to - 30)) / 30);
  const up = easeInOut((f - (s56.from + 4)) / 18);
  const ty = lerp(lerp(430, 535, down), 380, up);
  const handsP = prog(f, s56.from, 8);
  const gone = 1 - easeInOut((f - (s57.from - 8)) / 14); // 片尾卡前旧场景完全清掉
  const keys: CamKey[] = [
    [s54.from - 12, 1.6, 760, 600],
    [s54.to - 4, 1.0, 960, 540],
    [blk('S55', 1) - 8, 1.35, 1209, 560],
    [s55.to - 34, 1.35, 1209, 560],
    [s56.from + 4, 2.1, 760, 680],
  ];
  return (
    <AbsoluteFill>
      {gone > 0 ? (
        <CamDiv f={f} keys={keys} style={{opacity: gone}}>
          <Svg>
            <Floor />
            <Belt phase={f} />
            {/* 空表盘 → S56 时 4:30 */}
            <g>
              <rect x={694} y={564} width={132} height={132} rx={10} fill={P.soft} stroke={P.ink} strokeWidth={4} />
              <circle cx={760} cy={630} r={52} fill={P.bg} stroke={P.ink} strokeWidth={4} />
              {Array.from({length: 12}).map((_, i) => {
                const a = (i / 12) * Math.PI * 2;
                const r1 = 52 - (i % 3 === 0 ? 13 : 8);
                return <line key={i} x1={760 + Math.cos(a) * r1} y1={630 + Math.sin(a) * r1} x2={760 + Math.cos(a) * 49} y2={630 + Math.sin(a) * 49} stroke={P.ink} strokeWidth={i % 3 === 0 ? 4 : 2} />;
              })}
            </g>
            {handsP > 0 ? (
              <g transform={`translate(760 630) scale(${0.6 + 0.4 * handsP}) translate(-760 -630)`} opacity={handsP}>
                <Clock cx={760} cy={630} r={52} h={4} m={30} hot box={false} />
              </g>
            ) : null}
            <Clock cx={240} cy={630} h={10} m={10} opacity={0.9} />
            <Clock cx={460} cy={630} h={10} m={10} opacity={0.9} />
            <Arm bx={bx} tx={bx} ty={ty} open={0.2 + 0.4 * down * (1 - up)} />
          </Svg>
          {/* 工单：放大，逐行填满 */}
          <div style={{position: 'absolute', inset: 0, opacity: prog(f, s54.from - 8, 12)}}>
            <Card x={1120} y={196} w={720} rot={2} style={{padding: '20px 30px'}}>
              <div style={{fontSize: 40, fontWeight: 900, marginBottom: 6}}>工单</div>
              <div style={{fontSize: 48, fontWeight: 800, height: 72, display: 'flex', alignItems: 'center'}}>画一只表</div>
              {ROWS.map((r, i) => {
                const p = prog(f, rowT[i] - 3, 10);
                return (
                  <div key={i} style={{display: 'flex', alignItems: 'center', height: 72, borderTop: `3px solid ${P.soft}`}}>
                    <RowCheck f={f} start={checkT + i * 7} />
                    <div style={{fontSize: 40, fontWeight: 700, color: P.mid, width: 170, flex: 'none', marginLeft: 12}}>{r.k}</div>
                    <div style={{fontSize: 48, fontWeight: 900, opacity: p, transform: `translateX(${(1 - p) * 16}px)`, whiteSpace: 'nowrap'}}>{r.v}</div>
                  </div>
                );
              })}
            </Card>
          </div>
          {f >= s56.from + 8 ? <Callout x={760} y={630} ex={830} ey={548} len={110} label="4:30" start={s56.from + 8} size={52} /> : null}
        </CamDiv>
      ) : null}
      {/* 片尾卡：纸面上两行大字 */}
      <Txt x={960} y={340} size={110} weight={900} center style={{opacity: prog(f, blk('S57', 0) + 4, 12), transform: `translateX(-50%) translateY(${(1 - prog(f, blk('S57', 0) + 4, 12)) * 20}px)`}}>
        模型决定上限
      </Txt>
      <Keyword text="你决定结果" cx={960} cy={640} size={150} start={blk('S57', 1) - 4} />
    </AbsoluteFill>
  );
};
