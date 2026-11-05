// 讲解部分：按 timeline.json（build.py 生成）逐屏渲染。版式、颜色见 ../script.md「风格卡」。
import React from 'react';
import {AbsoluteFill, Easing, Img, OffthreadVideo, Sequence, interpolate, staticFile, useCurrentFrame} from 'remotion';
import tl from './timeline.json';
import {C, FONT, Keyword, Stage} from './stage';

type Item = {src?: string; img?: string; len?: number; rate?: number};
type Co = {screen: number; cx: number; cy: number; rx: number; ry: number; at: number};
type Shot = {id: string; at: number; end: number; dur: number; layout: string; clips: Item[]; imgs?: Item[];
  labels?: string[]; kw: [string, number][]; co?: Co[]; push?: boolean; push_at?: number};
type R = {x: number; y: number; w: number};

const FPS = tl.fps;
const f = (s: number) => Math.round(s * FPS);
const ease = Easing.inOut(Easing.cubic);
const BIG: R = {x: 320, y: 100, w: 1280};
const RECTS: Record<string, R[]> = {
  single: [BIG], images: [BIG], mask: [BIG], sticker: [BIG], pushin: [BIG],
  dual: [{x: 120, y: 230, w: 820}, {x: 980, y: 230, w: 820}],
  trio: [{x: 60, y: 300, w: 560}, {x: 680, y: 300, w: 560}, {x: 1300, y: 300, w: 560}],
  six: [0, 1, 2, 3, 4, 5].map((i) => ({x: 120 + (i % 3) * 580, y: 130 + Math.floor(i / 3) * 370, w: 520})),
};
const KW_Y: Record<string, number> = {single: 880, images: 880, mask: 880, sticker: 880, pushin: 880, dual: 800, trio: 760, six: 870};

/** 屏幕框：local 帧从 0 开始 */
const Frame: React.FC<{r: R; children?: React.ReactNode; radius?: number}> = ({r, children, radius = 14}) => (
  <div style={{position: 'absolute', left: r.x, top: r.y, width: r.w, height: (r.w * 9) / 16, borderRadius: radius, overflow: 'hidden', background: '#000',
    boxShadow: `0 0 0 5px ${C.bezel}, 0 0 0 6px ${C.edge}, 0 24px 90px rgba(242,165,74,0.16)`}}>{children}</div>
);

const Media: React.FC<{it: Item; zoom?: number; origin?: string; fit?: 'cover' | 'contain'}> = ({it, zoom = 1, origin = '50% 50%', fit = 'cover'}) => {
  const st: React.CSSProperties = {width: '100%', height: '100%', objectFit: fit, transform: `scale(${zoom})`, transformOrigin: origin};
  return it.src ? <OffthreadVideo src={staticFile(it.src)} playbackRate={it.rate ?? 1} muted style={st} /> : <Img src={staticFile(it.img!)} style={st} />;
};

const Labels: React.FC<{rs: R[]; labels: string[]; small?: boolean}> = ({rs, labels, small}) => (
  <>{labels.map((t, i) => rs[i] && (
    <div key={i} style={{position: 'absolute', left: rs[i].x, width: rs[i].w, top: rs[i].y - (small ? 44 : 62), textAlign: 'center',
      fontFamily: FONT, fontWeight: 600, fontSize: small ? 28 : 36, letterSpacing: 6,
      color: t === '第六版' ? C.accent : C.dim}}>{t}</div>))}</>
);

/** 圈：源画面坐标 → 舞台坐标；zoom 与画面同步缩放（以屏幕中心为原点） */
const Ring: React.FC<{co: Co; r: R; start: number; zoom?: number}> = ({co, r, start, zoom = 1}) => {
  const fr = useCurrentFrame();
  const k = r.w / 1920, h = (r.w * 9) / 16, cx0 = r.x + r.w / 2, cy0 = r.y + h / 2;
  const cx = cx0 + (r.x + co.cx * k - cx0) * zoom, cy = cy0 + (r.y + co.cy * k - cy0) * zoom;
  const rx = co.rx * k * zoom, ry = co.ry * k * zoom;
  const p = interpolate(fr, [f(co.at) - start, f(co.at) - start + 12], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic)});
  const len = Math.PI * (3 * (rx + ry) - Math.sqrt((3 * rx + ry) * (rx + 3 * ry)));
  return (
    <svg style={{position: 'absolute', left: 0, top: 0}} width={1920} height={1080}>
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="none" stroke={C.accent} strokeWidth={8} strokeLinecap="round"
        strokeDasharray={len} strokeDashoffset={len * (1 - p * 1.04)} transform={`rotate(-4 ${cx} ${cy})`} />
    </svg>
  );
};

/** 一屏里的关键词按时间依次换（任何时刻最多一个） */
const Keywords: React.FC<{s: Shot}> = ({s}) => {
  const start = f(s.at);
  return (<>{s.kw.map(([t, at], i) => {
    const from = f(at) - start, to = i + 1 < s.kw.length ? f(s.kw[i + 1][1]) - start : f(s.end) - start;
    return <Sequence key={i} from={from} durationInFrames={Math.max(1, to - from)} layout="none"><Keyword text={t} appear={0} y={KW_Y[s.layout]} /></Sequence>;
  })}</>);
};

/** Ⅳ-2 示意：面片和擀面杖是两张平面贴纸，杖滑出面片也压不到它；最后倾斜过来，看出是两层纸 */
const Stickers: React.FC<{dur: number}> = ({dur}) => {
  const fr = useCurrentFrame(), s = fr / FPS;
  const pop = (t0: number) => interpolate(s, [t0, t0 + .35], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.back(2))});
  const pinY = interpolate(s, [.9, 3.6], [-170, 250], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: ease});
  const tilt = interpolate(s, [4.2, 6.2], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: ease});
  const card = (w: number, h: number, bg: string, r: number | string): React.CSSProperties => ({position: 'absolute', width: w, height: h, left: -w / 2, top: -h / 2,
    background: bg, borderRadius: r, border: '10px solid #FBF7EE', boxShadow: '0 10px 0 rgba(0,0,0,.18)'});
  return (
    <AbsoluteFill style={{background: 'repeating-linear-gradient(0deg, #7A5232 0px, #7A5232 52px, #6E4A2D 52px, #6E4A2D 56px)', perspective: 1400}}>
      <div style={{position: 'absolute', left: '50%', top: '50%', transformStyle: 'preserve-3d',
        transform: `rotateX(${58 * tilt}deg) rotateZ(${-18 * tilt}deg) scale(${1 - .12 * tilt})`}}>
        <div style={{...card(470, 400, '#F3E6C8', '50%'), transform: `scale(${pop(.1)})`}} />
        <div style={{...card(640, 64, '#C9935A', 32), transform: `translateY(${pinY}px) translateZ(${150 * tilt}px) scale(${pop(.45)})`}} />
      </div>
      <AbsoluteFill style={{background: 'radial-gradient(ellipse at 50% 50%, transparent 55%, rgba(0,0,0,.35))'}} />
    </AbsoluteFill>
  );
};

const ShotView: React.FC<{s: Shot}> = ({s}) => {
  const fr = useCurrentFrame(), start = f(s.at), len = f(s.end) - start;
  const rs = RECTS[s.layout];
  const fadeOut = s.layout === 'pushin' ? 1 : interpolate(fr, [len - 5, len], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const fadeIn = interpolate(fr, [0, 5], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const slow = interpolate(fr, [0, len], [1, 1.05]);                     // 静帧慢推，避免画面停住
  let body: React.ReactNode = null;
  if (s.layout === 'single' || s.layout === 'dual' || s.layout === 'trio' || s.layout === 'six') {
    const z = s.push ? slow : 1;
    body = (<>
      {s.clips.map((it, i) => rs[i] && <Frame key={i} r={rs[i]}><Media it={it} zoom={z} /></Frame>)}
      {s.labels && <Labels rs={rs} labels={s.labels} small={s.layout === 'six'} />}
      {(s.co ?? []).map((co, i) => <Ring key={i} co={co} r={rs[co.screen]} start={start} zoom={z} />)}
    </>);
  } else if (s.layout === 'images') {
    const n = s.imgs!.length, per = len / n, k = Math.min(n - 1, Math.floor(fr / per));
    const z = interpolate(fr - k * per, [0, per], [1, 1.06]);
    body = <Frame r={BIG}><div style={{width: '100%', height: '100%', background: '#15161B'}}><Media it={s.imgs![k]} zoom={z} fit="contain" /></div></Frame>;
  } else if (s.layout === 'mask') {
    const per = f(.45), seq = s.imgs!.length * per;
    const k = fr < seq ? Math.floor(fr / per) : 4;                        // 逐张放完，停在标红最明显的 6.5 s 那张
    const z = fr < seq ? 1 : interpolate(fr, [seq, len], [1, 1.5], {extrapolateRight: 'clamp', easing: ease});
    body = (<><Frame r={BIG}><Media it={s.imgs![k]} zoom={z} origin="60% 52%" /></Frame>{s.labels && <Labels rs={[BIG]} labels={s.labels} />}</>);
  } else if (s.layout === 'sticker') {
    body = <Frame r={BIG}><Stickers dur={s.dur} /></Frame>;
  } else if (s.layout === 'pushin') {
    const p = interpolate(fr, [f(s.push_at!) - start, len], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: ease});
    const r = {x: BIG.x * (1 - p), y: BIG.y * (1 - p), w: BIG.w + (1920 - BIG.w) * p};
    body = <Frame r={r} radius={14 * (1 - p)}><Media it={s.imgs![0]} zoom={interpolate(fr, [0, len], [1, 1.02])} /></Frame>;
  }
  return (<AbsoluteFill style={{opacity: Math.min(fadeIn, fadeOut)}}>{body}<Keywords s={s} /></AbsoluteFill>);
};

export const Explainer: React.FC = () => (
  <Stage>
    {(tl.shots as Shot[]).map((s) => (
      <Sequence key={s.id} from={f(s.at)} durationInFrames={f(s.end) - f(s.at)}><ShotView s={s} /></Sequence>
    ))}
  </Stage>
);

export const EXPLAINER_FRAMES = f(tl.end);
