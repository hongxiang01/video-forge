import React from 'react';
import {AbsoluteFill} from 'remotion';
import {P, Svg, Floor, Belt, Gate, Card, Txt, Sign, Callout, Mark, Strike, at, blk, prog, lerp, easeInOut, clamp01, useF} from '../kit';

// SC10：S31–S34 第 3 条防错法（全片唯一用 Gate hazard 警示斜纹的工位）。
// S31 "第三条，|能让机器拦的，别靠自觉"：编号卡 3 + 关键词。
// S32 "新乡重夫…|工人装开关，|偶尔会漏掉一根弹簧"：开关外壳上线，第 1 根弹簧装进去，第 2 根弹开掉地上，外壳照样被送走。
// S33 "他没让大家多加小心|而是…放进小碟"："多加小心"告示被划掉；小碟出现，两根弹簧落进碟里。
// S34 "装完碟里还剩一根，|就是漏了，|当场就能补"：装 1 根后碟里剩 1 根 → 停线、灯红、警示斜纹亮；补上 → 绿勾，放行。

/** 编号卡（各条原则统一样式） */
const NumCard: React.FC<{n: number; start: number}> = ({n, start}) => {
  const f = useF();
  const p = prog(f, start, 12);
  return (
    <div style={{position: 'absolute', inset: 0, opacity: p, transform: `translateY(${(1 - p) * -30}px)`}}>
      <Card x={70} y={70} w={110} h={110} style={{padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
        <div style={{fontSize: 72, fontWeight: 900, color: P.accent, lineHeight: 1}}>{n}</div>
      </Card>
    </div>
  );
};

/** 关键帧相机：keys=[帧, 缩放, 焦点x, 焦点y]，焦点放到画面中心；相邻关键帧之间 easeInOut，相同值即停留 */
type CamKey = [number, number, number, number];
const camAt = (f: number, keys: CamKey[]) => {
  if (f <= keys[0][0]) return keys[0];
  for (let i = 0; i < keys.length - 1; i++) {
    const [f0, s0, x0, y0] = keys[i];
    const [f1, s1, x1, y1] = keys[i + 1];
    if (f < f1) {
      const t = easeInOut((f - f0) / Math.max(1, f1 - f0));
      return [f, lerp(s0, s1, t), lerp(x0, x1, t), lerp(y0, y1, t)] as CamKey;
    }
  }
  return keys[keys.length - 1];
};
const KCam: React.FC<{keys: CamKey[]; children: React.ReactNode}> = ({keys, children}) => {
  const [, s, cx, cy] = camAt(useF(), keys);
  return <div style={{position: 'absolute', inset: 0, transformOrigin: '0 0', transform: `translate(${960 - cx * s}px, ${540 - cy * s}px) scale(${s})`}}>{children}</div>;
};

/** 弹簧（锯齿线）。(x,y) 中心，len 长度，rot 角度（0=竖直） */
const Spring: React.FC<{x: number; y: number; len?: number; amp?: number; rot?: number; color?: string; opacity?: number}> = ({x, y, len = 100, amp = 14, rot = 0, color = P.ink, opacity = 1}) => {
  const n = 8;
  const pts: string[] = [`M 0 ${-len / 2}`, `L 0 ${-len / 2 + 8}`];
  for (let i = 0; i < n; i++) {
    const yy = -len / 2 + 8 + ((i + 0.5) / n) * (len - 16);
    pts.push(`L ${i % 2 === 0 ? amp : -amp} ${yy.toFixed(1)}`);
  }
  pts.push(`L 0 ${len / 2 - 8}`, `L 0 ${len / 2}`);
  return <path d={pts.join(' ')} transform={`translate(${x} ${y}) rotate(${rot})`} stroke={color} strokeWidth={5} fill="none" strokeLinejoin="round" strokeLinecap="round" opacity={opacity} />;
};

// 外壳几何：cx 为中心；底在传送带顶 BELT_Y
const BELT_Y = 720;
const SLOT_Y = 642; // 槽内弹簧中心 y
const slotX = (cx: number, k: 0 | 1) => cx + (k === 0 ? -60 : 60);

/** 开关外壳（矩形 + 两个按钮 + 两个弹簧槽）。empty[k]=true 时槽 k 画虚线空位 */
const Housing: React.FC<{cx: number; empty?: [boolean, boolean]; opacity?: number}> = ({cx, empty = [false, false], opacity = 1}) => (
  <g opacity={opacity}>
    <rect x={cx - 140} y={560} width={280} height={160} rx={10} fill={P.soft} stroke={P.ink} strokeWidth={4} />
    <rect x={cx - 120} y={584} width={240} height={116} rx={6} fill={P.bg} stroke={P.ink} strokeWidth={3} />
    {[-70, 70].map((dx) => (
      <rect key={dx} x={cx + dx - 26} y={536} width={52} height={24} rx={5} fill={P.ink} />
    ))}
    {[0, 1].map((k) =>
      empty[k] ? <rect key={k} x={slotX(cx, k as 0 | 1) - 22} y={SLOT_Y - 52} width={44} height={104} rx={6} fill="none" stroke={P.mid} strokeWidth={3} strokeDasharray="8 7" /> : null,
    )}
  </g>
);

// 小碟（左侧小桌上）
const DISH = {cx: 300, cy: 706};
const Dish: React.FC<{opacity: number; children?: React.ReactNode}> = ({opacity, children}) => (
  <g opacity={opacity}>
    {/* 小桌 */}
    <rect x={110} y={740} width={380} height={18} fill={P.soft} stroke={P.ink} strokeWidth={4} />
    <line x1={140} y1={758} x2={140} y2={900} stroke={P.ink} strokeWidth={4} />
    <line x1={460} y1={758} x2={460} y2={900} stroke={P.ink} strokeWidth={4} />
    {/* 碟：后沿 → 弹簧 → 前沿 */}
    <ellipse cx={DISH.cx} cy={DISH.cy} rx={160} ry={30} fill={P.white} stroke={P.ink} strokeWidth={4} />
    {children}
    <path d={`M ${DISH.cx - 160} ${DISH.cy} Q ${DISH.cx - 150} ${DISH.cy + 34} ${DISH.cx} ${DISH.cy + 34} Q ${DISH.cx + 150} ${DISH.cy + 34} ${DISH.cx + 160} ${DISH.cy}`} fill={P.white} stroke={P.ink} strokeWidth={4} />
  </g>
);

/** 抛物线插值：从 a 到 b，中途抬高 lift */
const arc = (a: [number, number], b: [number, number], t: number, lift = 140): [number, number] => {
  const e = easeInOut(t);
  return [lerp(a[0], b[0], e), lerp(a[1], b[1], e) - Math.sin(Math.PI * clamp01(t)) * lift];
};

export const SC10: React.FC = () => {
  const f = useF();
  const s31 = at('S31');
  const s32 = at('S32');
  const s33 = at('S33');
  const s34 = at('S34');
  const install = blk('S32', 1); // 工人装开关
  const miss = blk('S32', 2); // 漏掉一根
  const careful = blk('S33', 0);
  const dishT = blk('S33', 1);
  const left = blk('S34', 0); // 装完碟里还剩一根
  const leaked = blk('S34', 1); // 就是漏了
  const fix = blk('S34', 2); // 当场就能补
  const alarm = left + 26;
  const fixed = fix + 20;

  // 外壳 1（S32）：入场 → 装 1 根 → 第 2 根弹开 → 照样被送走
  const h1x = f < miss + 26 ? lerp(560, 760, easeInOut((f - (s32.from + 6)) / 30)) : lerp(760, 2100, easeInOut((f - (miss + 26)) / 40));
  const h1op = prog(f, s32.from + 6, 10);
  // 外壳 2（S33–S34）：入场 → 被拦 → 补完放行
  const h2x = f < fixed + 6 ? lerp(560, 760, easeInOut((f - careful) / 30)) : lerp(760, 2100, easeInOut((f - (fixed + 6)) / 50));
  const h2op = prog(f, careful, 10);
  const housing1 = f < careful + 4;

  // 弹簧（S32）
  const sp1T = prog(f, install + 4, 14, easeInOut);
  const sp1y = lerp(380, SLOT_Y, sp1T);
  const fallA = prog(f, miss + 2, 10, (x) => clamp01(x) * clamp01(x)); // 下落撞到按钮
  const fallB = clamp01((f - (miss + 12)) / 18); // 弹开落地
  const sp2Start: [number, number] = [slotX(760, 1), 380];
  const sp2Hit: [number, number] = [slotX(760, 1) + 10, 500];
  const sp2Land: [number, number] = [1060, 886];
  const sp2Pos: [number, number] = fallB > 0 ? arc(sp2Hit, sp2Land, fallB, 90) : [lerp(sp2Start[0], sp2Hit[0], fallA), lerp(sp2Start[1], sp2Hit[1], fallA)];
  const sp2Rot = lerp(0, 96, easeInOut(fallB));
  const sp2Op = 1 - prog(f, careful, 10);

  // 小碟与弹簧（S33–S34）
  const dishOp = prog(f, dishT, 12);
  const inA = prog(f, dishT + 12, 12, (x) => clamp01(x) * clamp01(x));
  const inB = prog(f, dishT + 26, 12, (x) => clamp01(x) * clamp01(x));
  const restA: [number, number] = [DISH.cx - 72, DISH.cy - 12];
  const restB: [number, number] = [DISH.cx + 72, DISH.cy - 12];
  // S34：A 装进槽 1；B 补进槽 2
  const moveA = clamp01((f - (left + 2)) / 20);
  const moveB = clamp01((f - (fix + 2)) / 18);
  const posA: [number, number] = moveA > 0 ? arc(restA, [slotX(h2x, 0), SLOT_Y], moveA, 160) : [restA[0], lerp(420, restA[1], inA)];
  const posB: [number, number] = moveB > 0 ? arc(restB, [slotX(h2x, 1), SLOT_Y], moveB, 180) : [restB[0], lerp(420, restB[1], inB)];
  const rotA = moveA > 0 ? lerp(90, 0, easeInOut(moveA)) : lerp(0, 90, inA);
  const rotB = moveB > 0 ? lerp(-90, 0, easeInOut(moveB)) : lerp(0, -90, inB);
  const lenA = moveA > 0 ? lerp(120, 100, moveA) : lerp(100, 120, inA);
  const lenB = moveB > 0 ? lerp(120, 100, moveB) : lerp(100, 120, inB);

  // 报警：停线、灯红、斜纹亮
  const alarmOn = f >= alarm && f < fixed;
  const blink = alarmOn ? (Math.floor((f - alarm) / 6) % 2 === 0 ? 1 : 0.35) : 0;
  const beltPhase = f < alarm ? f : f < fixed ? alarm : f - (fixed - alarm);
  const lamp = f >= fixed ? P.ok : alarmOn ? P.accent : P.mid;

  const signOp = 1 - prog(f, s32.from - 6, 10);
  // 相机：S31 全景 → S32 推近外壳 → 外壳送走时拉回 → S33 小碟时推近特写 → S34 报警拉开看门 → 放行跟随
  const cam: CamKey[] = [
    [s31.from - 12, 1.0, 960, 540],
    [s32.from, 1.04, 960, 540],
    [install, 1.28, 780, 600],
    [miss + 24, 1.28, 780, 600],
    [miss + 60, 1.06, 1000, 560],
    [dishT - 2, 1.06, 960, 560],
    [dishT + 22, 1.6, 470, 660],
    [left + 22, 1.6, 470, 660],
    [alarm + 10, 1.14, 900, 560],
    [fixed + 6, 1.14, 900, 560],
    [s34.to + 40, 1.06, 1060, 560],
  ];

  return (
    <AbsoluteFill>
      <KCam keys={cam}>
        <Svg>
          <Floor windows={false} />
          <Belt x0={520} x1={1860} y={BELT_Y} phase={beltPhase} />
          <Gate x={1220} y={480} bottom={BELT_Y} w={360} hazard={alarmOn} beam={alarmOn ? blink : 0.35} lamp={lamp} />
          {/* 外壳 1 */}
          {housing1 && h1op > 0 ? (
            <g opacity={h1op}>
              <Housing cx={h1x} empty={[f < install + 18, true]} />
              {f >= install + 4 ? <Spring x={f < install + 18 ? slotX(760, 0) : slotX(h1x, 0)} y={sp1y} opacity={prog(f, install + 4, 5)} /> : null}
            </g>
          ) : null}
          {/* 漏掉的第 2 根弹簧 */}
          {f >= miss + 2 && sp2Op > 0 ? <Spring x={sp2Pos[0]} y={sp2Pos[1]} rot={sp2Rot} opacity={Math.min(prog(f, miss + 2, 4), sp2Op)} /> : null}
          {/* 外壳 2 */}
          {!housing1 ? <Housing cx={h2x} opacity={h2op} empty={[moveA < 1, moveB < 1]} /> : null}
          {/* 小碟 + 弹簧 */}
          <Dish opacity={dishOp}>
            {f >= dishT + 12 && moveA === 0 ? <Spring x={posA[0]} y={posA[1]} rot={rotA} len={lenA} amp={14} /> : null}
            {f >= dishT + 26 && moveB === 0 ? <Spring x={posB[0]} y={posB[1]} rot={rotB} len={lenB} amp={14} color={alarmOn ? P.accent : P.ink} /> : null}
          </Dish>
          {moveA > 0 ? <Spring x={moveA < 1 ? posA[0] : slotX(h2x, 0)} y={posA[1]} rot={rotA} len={lenA} /> : null}
          {moveB > 0 ? <Spring x={moveB < 1 ? posB[0] : slotX(h2x, 1)} y={posB[1]} rot={rotB} len={lenB} /> : null}
          {f >= fixed ? <Mark x={h2x} y={470} kind="ok" s={1.2} start={fixed} /> : null}
        </Svg>
        {/* "多加小心"告示 → 划掉 */}
        <div style={{position: 'absolute', inset: 0, opacity: prog(f, careful - 2, 10) * (f >= s34.from ? 0.55 : 1), transform: `translateY(${(1 - prog(f, careful - 2, 14)) * 24}px)`}}>
          <Card x={1250} y={170} w={380} rot={-2}>
            <div style={{fontSize: 40, fontWeight: 800, marginBottom: 6}}>告示</div>
            <div style={{fontSize: 64, fontWeight: 900, lineHeight: 1.2}}>多加小心</div>
          </Card>
          <Svg>
            {f >= careful + 20 ? <Strike x={1270} y={312} w={300} start={careful + 20} /> : null}
          </Svg>
        </div>
        {/* 标注：碟里还剩一根 */}
        {f >= leaked - 2 ? (
          <div style={{position: 'absolute', inset: 0, opacity: 1 - prog(f, fix - 4, 6)}}>
            <Callout x={restB[0]} y={restB[1] - 14} ex={420} ey={560} len={120} label="漏了" start={leaked - 2} size={48} />
          </div>
        ) : null}
      </KCam>
      {/* 口号吊牌（S31）：从上方落进工厂 */}
      {signOp > 0 ? (
        <div style={{position: 'absolute', inset: 0, opacity: signOp}}>
          <Sign text="能让机器拦的，别靠自觉" num="3" cx={960} y={200} start={s31.from} size={84} />
        </div>
      ) : null}
      <NumCard n={3} start={s32.from - 2} />
      {/* 来源 */}
      <Txt x={70} y={930} size={32} weight={600} color={P.mid} style={{opacity: prog(f, s32.from, 10)}}>
        新乡重夫 · 丰田
      </Txt>
    </AbsoluteFill>
  );
};
