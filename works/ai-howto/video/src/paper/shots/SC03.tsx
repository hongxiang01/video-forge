import React from 'react';
import {AbsoluteFill} from 'remotion';
import {P, Svg, Arm, Clock, Txt, Keyword, Mark, Strike, FONT, at, blk, prog, lerp, easeInOut, clamp01, useF} from '../kit';

// SC03：S08–S09 它学会的是"通常长什么样"。
// S08 "它学会的不是指针怎么指时间|而是手表通常长什么样"：左卡"指针 ↔ 时间"（4:30 表盘 ↔ 4:30）被划掉；第 2 块相机推向右卡"手表通常长这样"（一叠 10:10），打勾。
// S09 "所以你没说清楚的地方，|它就按最常见的样子补上"：横版工单 4 栏只填了"时间 4:30"，空栏冒出问号；机械臂拿印章逐个盖"最常见"；末拍带圈关键词"平均答案"。

// ───────── 相机（SC02/SC04/SC05 共用）：关键帧 [帧, 缩放, 画面中心 x, y]，段间 easeInOut ─────────
export type CamKey = [number, number, number, number];
export const camAt = (f: number, keys: CamKey[]) => {
  let k = keys[0];
  let s = k[1];
  let cx = k[2];
  let cy = k[3];
  for (let i = 1; i < keys.length; i++) {
    const a = keys[i - 1];
    const b = keys[i];
    if (f <= a[0]) break;
    const t = easeInOut((f - a[0]) / Math.max(1, b[0] - a[0]));
    s = lerp(a[1], b[1], t);
    cx = lerp(a[2], b[2], t);
    cy = lerp(a[3], b[3], t);
    k = b;
  }
  return {s, cx, cy};
};
/** 关键帧相机：把世界点 (cx,cy) 放到画面中心，缩放 s */
export const CamK: React.FC<{keys: CamKey[]; children: React.ReactNode}> = ({keys, children}) => {
  const f = useF();
  const {s, cx, cy} = camAt(f, keys);
  return <div style={{position: 'absolute', inset: 0, transform: `translate(${960 - cx * s}px, ${540 - cy * s}px) scale(${s})`, transformOrigin: '0 0'}}>{children}</div>;
};

/** 纸卡（与 kit Card 同风格，标题字号 ≥36） */
export const PaperCard: React.FC<{x: number; y: number; w: number; h: number; title?: string; size?: number; children?: React.ReactNode}> = ({x, y, w, h, title, size = 44, children}) => (
  <div style={{position: 'absolute', left: x, top: y, width: w, height: h, background: P.white, border: `4px solid ${P.ink}`, borderRadius: 10, boxShadow: `8px 8px 0 ${P.soft}`, boxSizing: 'border-box', fontFamily: FONT, color: P.ink}}>
    {title ? <div style={{position: 'absolute', left: 30, top: 18, fontSize: size, fontWeight: 900, letterSpacing: 1, whiteSpace: 'nowrap'}}>{title}</div> : null}
    {children}
  </div>
);

// ───────── 工单 + 盖章（SC05 复用） ─────────
export const WO = {x: 160, y: 556, w: 1600, h: 364};
const FIELDS = ['时间', '风格', '颜色', '给谁看'];
const FIELD_W = 363;
const FIELD_STEP = 391;
const BOX_TOP = 150;
const BOX_H = 130;
/** 第 i 栏空框中心（全局坐标） */
export const fieldCenter = (i: number) => ({x: WO.x + 4 + 28 + i * FIELD_STEP + FIELD_W / 2, y: WO.y + 4 + BOX_TOP + BOX_H / 2});

/** 横版工单：4 栏，只有"时间 4:30"填了。q=空栏问号出现进度，stamps=每栏盖章帧（null=不盖） */
export const WorkOrder: React.FC<{op: number; q: number; stamps: Array<number | null>}> = ({op, q, stamps}) => {
  const f = useF();
  return (
    <div style={{position: 'absolute', inset: 0, opacity: op, transform: `translateY(${(1 - op) * 30}px)`}}>
      <PaperCard x={WO.x} y={WO.y} w={WO.w} h={WO.h} title="工单" size={42}>
        {FIELDS.map((name, i) => {
          const st = stamps[i];
          const sp = st == null ? 0 : prog(f, st, 5);
          return (
            <div key={i} style={{position: 'absolute', left: 28 + i * FIELD_STEP, top: 92, width: FIELD_W}}>
              <div style={{fontSize: 40, fontWeight: 800, color: P.mid, lineHeight: 1}}>{name}</div>
              <div
                style={{
                  position: 'absolute',
                  top: BOX_TOP - 92,
                  width: FIELD_W,
                  height: BOX_H,
                  boxSizing: 'border-box',
                  border: i === 0 ? `4px solid ${P.ink}` : `4px dashed ${P.mid}`,
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {i === 0 ? (
                  <span style={{fontSize: 68, fontWeight: 900, color: P.ink}}>4:30</span>
                ) : (
                  <span style={{fontSize: 68, fontWeight: 900, color: P.mid, opacity: clamp01(q * 3 - (i - 1)) * (1 - sp)}}>?</span>
                )}
                {sp > 0 ? (
                  <div
                    style={{
                      position: 'absolute',
                      left: '50%',
                      top: '50%',
                      transform: `translate(-50%,-50%) rotate(-7deg) scale(${lerp(1.25, 1, sp)})`,
                      opacity: 0.92 * sp,
                      border: `6px solid ${P.accent}`,
                      borderRadius: 8,
                      padding: '4px 18px',
                      fontSize: 56,
                      fontWeight: 900,
                      color: P.accent,
                      letterSpacing: 4,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    最常见
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </PaperCard>
    </div>
  );
};

const UP = 540;
const DOWN = 690;
/** 拿印章的机械臂：times[k] 时刻盖在第 cols[k] 栏 */
export const StampArm: React.FC<{times: number[]; cols: number[]; x0: number; op?: number}> = ({times, cols, x0, op = 1}) => {
  const f = useF();
  let x = x0;
  let press = 0;
  times.forEach((t, k) => {
    x = lerp(x, fieldCenter(cols[k]).x, easeInOut((f - (t - 16)) / 10));
    const down = f < t ? easeInOut((f - (t - 6)) / 6) : 1 - easeInOut((f - t - 2) / 8);
    press = Math.max(press, clamp01(down));
  });
  const ty = lerp(UP, DOWN, press);
  return (
    <g opacity={op}>
      <Arm bx={x} tx={x} ty={ty} railY={300} railX0={120} railX1={1800} open={0} />
      {/* 印章：手柄 + 章体，章面底在 ty+102 */}
      <rect x={x - 16} y={ty + 18} width={32} height={46} rx={6} fill={P.ink} />
      <rect x={x - 76} y={ty + 62} width={152} height={34} rx={6} fill={P.ink} />
      <rect x={x - 72} y={ty + 94} width={144} height={8} rx={2} fill={P.accent} />
    </g>
  );
};

export const SC03: React.FC = () => {
  const f = useF();
  const s8 = at('S08');
  const s9 = at('S09');
  const b81 = blk('S08', 1);
  const b91 = blk('S09', 1);

  const leftIn = prog(f, s8.from - 4, 14);
  const rightIn = prog(f, b81 - 4, 14);
  const cardsOut = prog(f, s9.from - 6, 10);
  const woIn = prog(f, s9.from, 14);
  const stamps = [b91 + 8, b91 + 26, b91 + 44];
  const kwStart = s9.to - 12;

  // S08：先全景缓推，第 2 块推向右卡（本句主角）
  const camA: CamKey[] = [
    [s8.from - 12, 1, 960, 540],
    [b81 - 6, 1.04, 960, 545],
    [b81 + 22, 1.13, 1180, 560],
    [s9.from, 1.15, 1200, 560],
  ];
  // S09：整体缓推，跟着印章往右
  const camB: CamKey[] = [
    [s9.from - 2, 1, 960, 540],
    [b91 + 50, 1.08, 1010, 545],
    [s9.to + 30, 1.08, 1000, 540],
  ];

  return (
    <AbsoluteFill>
      {cardsOut < 1 ? (
        <AbsoluteFill style={{opacity: 1 - cardsOut}}>
          <CamK keys={camA}>
            {/* 左卡：规则 */}
            <div style={{position: 'absolute', inset: 0, opacity: leftIn, transform: `translateY(${(1 - leftIn) * 24}px)`}}>
              <PaperCard x={220} y={220} w={700} h={660} title="指针 ↔ 时间" />
            </div>
            {/* 右卡：通常长这样 */}
            <div style={{position: 'absolute', inset: 0, opacity: rightIn, transform: `translateY(${(1 - rightIn) * 24}px)`}}>
              <PaperCard x={1000} y={220} w={700} h={660} title="手表通常长这样" />
            </div>
            <Txt x={698} y={562} size={72} weight={900} style={{opacity: leftIn}}>
              4:30
            </Txt>
            <Svg>
              <g opacity={leftIn}>
                <Clock cx={430} cy={600} r={135} h={4} m={30} />
                <path d="M 592 600 L 660 600 M 604 584 L 588 600 L 604 616 M 648 584 L 664 600 L 648 616" stroke={P.ink} strokeWidth={6} fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </g>
              <Strike x={250} y={620} w={640} start={s8.from + 34} />
              <g opacity={rightIn}>
                {[0, 1, 2, 3, 4].map((k) => (
                  <Clock key={k} cx={1230 + k * 46} cy={470 + k * 56} r={108} h={10} m={10} />
                ))}
              </g>
              <Mark x={1610} y={350} s={1.6} kind="ok" start={b81 + 22} />
            </Svg>
          </CamK>
        </AbsoluteFill>
      ) : null}
      {f >= s9.from - 2 ? (
        <CamK keys={camB}>
          <WorkOrder op={woIn} q={clamp01((f - (s9.from + 14)) / 30)} stamps={[null, ...stamps]} />
          <Svg>
            <StampArm times={stamps} cols={[1, 2, 3]} x0={fieldCenter(1).x} op={woIn} />
          </Svg>
          {f >= kwStart ? <Keyword text="平均答案" cx={960} cy={150} start={kwStart} size={100} circle circleAt={kwStart + 10} /> : null}
        </CamK>
      ) : null}
    </AbsoluteFill>
  );
};
